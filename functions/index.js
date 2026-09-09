/**
 * ToolPulse — tägliche Kuratierungs-Funktion
 * -------------------------------------------
 * Läuft einmal pro Tag (Cloud Scheduler), fragt für jeden Bereich per
 * Claude + Websuche nach aktuell empfehlenswerten Tools und schreibt das
 * Ergebnis nach Firestore. Die Web-App liest ausschließlich aus Firestore
 * und ruft nie selbst ein LLM auf.
 *
 * Voraussetzungen (siehe README.md):
 *   firebase functions:secrets:set ANTHROPIC_API_KEY
 *   firebase deploy --only functions
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Anthropic = require("@anthropic-ai/sdk");

admin.initializeApp();
const db = admin.firestore();

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

// Ein Eintrag hier + eine passende Ergänzung in `src/data/categories.ts`
// reicht, um einen neuen Themenbereich hinzuzufügen.
const CATEGORIES = [
  {
    id: "llm",
    label: "Beste LLMs",
    focus:
      "Sprachmodelle und Chat-Assistenten. Stütze dich auf Leaderboards und Vergleiche (z.B. LMArena/Chatbot Arena, offizielle Modell-Ankündigungen von Anthropic/OpenAI/Google/Meta/Mistral, Hacker News, Reddit r/LocalLLaMA) statt auf Marketingtexte allein. Nenne bei jedem Eintrag kurz, worin er sich abhebt (z.B. Coding, Kontextlänge, Kosten, Open Weights).",
  },
  {
    id: "ki-bild",
    label: "KI-Bildgenerierung",
    focus:
      "KI-Bildgenerierung: konzentriere dich auf Modelle/Tools zum Erzeugen und Bearbeiten von Bildern per KI (z.B. Midjourney, ChatGPT-Bildgenerierung, Gemini, FLUX, Stable Diffusion, Ideogram). Erwähne bei jedem Eintrag kurz, worin es sich abhebt (z.B. Fotorealismus, Text-im-Bild, Bildbearbeitung, Geschwindigkeit, Open Source).",
  },
  {
    id: "dev-trends",
    label: "Dev-Trends",
    focus:
      "Aktuelle Entwicklertrends: Frameworks, Sprachen, Libraries, Build-Tools und KI-Coding-Assistenten, die gerade an Fahrt gewinnen. Durchsuche gezielt Entwicklerportale wie GitHub Trending, Hacker News, dev.to, Product Hunt und Stack Overflow — nicht nur allgemeine Nachrichten.",
  },
  {
    id: "design-trends",
    label: "Design-Trends",
    focus:
      "Aktuelle Design- und UI/UX-Trends sowie die Tools dahinter. Durchsuche gezielt Designerportale wie Awwwards, Dribbble, Behance, Smashing Magazine und Muzli. Erwähne bei jedem Eintrag den erkennbaren Trend (z.B. Bento-Grids, Glassmorphism, KI-gestütztes Prototyping).",
  },
];

const SYSTEM_PROMPT = `Du bist ein sorgfältiger Produkt-Scout. Du recherchierst per \
Websuche die aktuell besten, real existierenden Tools/Apps/Dienste für einen \
gegebenen Lebensbereich. Antworte AUSSCHLIESSLICH mit einem JSON-Array, ohne \
Markdown, ohne Erklärtext. Jedes Element hat exakt diese Felder:
{
  "name": string,
  "tagline": string (max. 80 Zeichen, auf Deutsch),
  "description": string (2-3 Sätze, auf Deutsch, sachlich),
  "url": string (offizielle Website),
  "priceTier": "kostenlos" | "freemium" | "abo" | "einmalig",
  "priceDetail": string | null,
  "sources": [{"name": string, "url": string}] (mind. 1, echte URLs aus der Websuche),
  "tags": string[]
}
Nenne nur Tools, die du über die Websuche verifizieren konntest. Erfinde keine \
URLs. Bevorzuge Tools mit echten Neuigkeiten oder Relevanz in den letzten Tagen, \
aber liefere auch bewährte Klassiker, falls nichts Neues auffindbar ist. \
Liefere 4-6 Einträge.`;

async function curateCategory(anthropic, category) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    messages: [
      {
        role: "user",
        content: `Bereich: ${category.label}.${
          category.focus ? ` Fokus: ${category.focus}` : ""
        } Recherchiere jetzt aktuell im Web und liefere das JSON-Array.`,
      },
    ],
  });

  const textBlocks = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const cleaned = textBlocks.replace(/```json|```/g, "").trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) {
    console.error(`Kein JSON-Array in Antwort für ${category.id}:`, cleaned);
    return [];
  }
  try {
    return JSON.parse(match[0]);
  } catch (e) {
    console.error(`JSON-Parse-Fehler für ${category.id}:`, e);
    return [];
  }
}

// Einfache Heuristik: mehr Quellen + kürzlich verifiziert = höherer Score.
// Kann später durch echte Kreuzprüfung mehrerer Suchanfragen ersetzt werden.
function computeTrustScore(entry) {
  const sourceCount = Array.isArray(entry.sources) ? entry.sources.length : 0;
  const base = 55;
  const sourceBonus = Math.min(sourceCount * 12, 36);
  return Math.min(base + sourceBonus, 95);
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Sendet eine Push-Benachrichtigung ans "Tool des Tages" — an alle
// registrierten Geräte aus der Collection `pushSubscriptions`. Räumt dabei
// Tokens auf, die FCM als ungültig/abgelaufen meldet.
async function notifyToolOfTheDay(tool) {
  const subsSnap = await db.collection("pushSubscriptions").get();
  const tokenToUid = new Map();
  subsSnap.forEach((doc) => {
    const tokens = doc.data().tokens ?? [];
    for (const token of tokens) tokenToUid.set(token, doc.id);
  });

  const tokens = [...tokenToUid.keys()];
  if (tokens.length === 0) return;

  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: {
      title: "🔥 Tool des Tages",
      body: `${tool.name} — ${tool.tagline}`,
    },
    data: { url: tool.url, toolId: tool.id },
  });

  const staleByUid = new Map();
  response.responses.forEach((r, i) => {
    const code = r.error?.code;
    if (
      code === "messaging/registration-token-not-registered" ||
      code === "messaging/invalid-registration-token"
    ) {
      const uid = tokenToUid.get(tokens[i]);
      if (!staleByUid.has(uid)) staleByUid.set(uid, []);
      staleByUid.get(uid).push(tokens[i]);
    }
  });

  await Promise.all(
    [...staleByUid.entries()].map(([uid, staleTokens]) =>
      db
        .collection("pushSubscriptions")
        .doc(uid)
        .update({ tokens: admin.firestore.FieldValue.arrayRemove(...staleTokens) })
    )
  );

  console.log(
    `Tool des Tages Push: ${response.successCount}/${tokens.length} zugestellt.`
  );
}

async function runCuration() {
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
  const now = new Date().toISOString();
  let added = 0;
  let updated = 0;
  const touched = [];
  let toolOfTheDay = null;

  for (const category of CATEGORIES) {
    let entries = [];
    try {
      entries = await curateCategory(anthropic, category);
    } catch (e) {
      console.error(`Kuratierung fehlgeschlagen für ${category.id}:`, e);
      continue;
    }
    if (!entries.length) continue;
    touched.push(category.id);

    for (const entry of entries) {
      if (!entry.name || !entry.url) continue;
      const id = `${category.id}-${slugify(entry.name)}`;
      const ref = db.collection("tools").doc(id);
      const existing = await ref.get();

      const toolDoc = {
        id,
        name: entry.name,
        categoryId: category.id,
        tagline: entry.tagline ?? "",
        description: entry.description ?? "",
        url: entry.url,
        priceTier: entry.priceTier ?? "freemium",
        priceDetail: entry.priceDetail ?? null,
        trustScore: computeTrustScore(entry),
        sources: entry.sources ?? [],
        tags: entry.tags ?? [],
        firstSeen: existing.exists ? existing.data().firstSeen : now,
        lastUpdated: now,
        isNew: !existing.exists,
      };

      await ref.set(toolDoc, { merge: true });
      if (existing.exists) {
        updated++;
      } else {
        added++;
        if (!toolOfTheDay || toolDoc.trustScore > toolOfTheDay.trustScore) {
          toolOfTheDay = toolDoc;
        }
      }
    }
  }

  await db.collection("curationRuns").add({
    ranAt: now,
    toolsAdded: added,
    toolsUpdated: updated,
    categoriesTouched: touched,
    toolOfTheDayId: toolOfTheDay?.id ?? null,
  });

  if (toolOfTheDay) {
    try {
      await notifyToolOfTheDay(toolOfTheDay);
    } catch (e) {
      console.error("Push-Versand für Tool des Tages fehlgeschlagen:", e);
    }
  }

  console.log(`Kuratierung abgeschlossen: ${added} neu, ${updated} aktualisiert.`);
}

// Läuft täglich um 06:00 Europe/Berlin.
exports.dailyCuration = onSchedule(
  {
    schedule: "0 6 * * *",
    timeZone: "Europe/Berlin",
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    await runCuration();
  }
);

// Manueller Trigger zum Testen: HTTPS-Aufruf statt auf den Zeitplan zu warten.
exports.runCurationNow = onRequest(
  { secrets: [ANTHROPIC_API_KEY] },
  async (req, res) => {
    try {
      await runCuration();
      res.status(200).send("Kuratierung ausgeführt.");
    } catch (e) {
      console.error(e);
      res.status(500).send(String(e));
    }
  }
);
