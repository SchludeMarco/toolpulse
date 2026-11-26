/**
 * GET /api/news — aktuelle News pro Bereich.
 *
 * Läuft als Vercel Function und fragt per Vercel AI Gateway ein Modell mit
 * eingebauter Websuche (Perplexity Sonar) nach den wichtigsten Meldungen der
 * letzten 7 Tage. Authentifizierung über das OIDC-Token des Projekts, also
 * ohne eigenen API-Key.
 *
 * Das Suchmodell erlaubt nur 5 Anfragen pro Minute. Deshalb löst ein
 * Seitenaufruf nie selbst eine Suche aus: Die Function liefert immer den
 * zuletzt gespeicherten Stand aus dem Vercel Runtime Cache und stößt, wenn
 * der älter als 6 Stunden ist, genau einen Abruf im Hintergrund an (mit
 * Sperre gegen parallele Abrufe). Fällt ein Bereich aus, bleiben seine
 * bisherigen News stehen.
 */
import { getVercelOidcToken } from "@vercel/oidc";
import { getCache, waitUntil } from "@vercel/functions";

const MODEL = "perplexity/sonar";
const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";

// Muss zu den IDs in src/data/categories.ts passen.
const CATEGORIES = [
  {
    id: "llm",
    label: "Beste LLMs",
    focus:
      "Sprachmodelle und KI-Assistenten: neue Modell-Releases und Updates von Anthropic, OpenAI, Google, Meta, Mistral, DeepSeek u.a., Benchmarks, Preise, Open-Weights-Modelle.",
  },
  {
    id: "ki-bild",
    label: "KI-Bildgenerierung",
    focus:
      "KI-Bild- und Videogenerierung: Midjourney, ChatGPT/GPT-Image, Gemini/Imagen, FLUX, Stable Diffusion, Ideogram, Runway u.a. – neue Versionen, Features, Rechtliches.",
  },
  {
    id: "dev-trends",
    label: "Dev-Trends",
    focus:
      "Softwareentwicklung: Frameworks, Sprachen, Libraries, Build-Tools, KI-Coding-Assistenten, wichtige Releases und Sicherheitsvorfälle (GitHub, Hacker News, dev.to).",
  },
  {
    id: "design-trends",
    label: "Design-Trends",
    focus:
      "UI/UX- und Webdesign: Design-Tools (Figma, Framer, Adobe u.a.), KI im Design, neue Features und Trends (Awwwards, Smashing Magazine, Dribbble).",
  },
] as const;

interface NewsItem {
  id: string;
  categoryId: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  fetchedAt: string;
}

const SYSTEM_PROMPT = `Du bist ein sorgfältiger Tech-Redakteur. Recherchiere per \
Websuche die wichtigsten Nachrichten der letzten 7 Tage zum genannten Bereich. \
Antworte AUSSCHLIESSLICH mit einem JSON-Array ohne Markdown und ohne \
Erklärtext. Jedes Element hat exakt diese Felder:
{"title": string (max. 100 Zeichen, Deutsch), "summary": string (1-2 Sätze, \
Deutsch, sachlich), "url": string (direkter Link auf den Artikel), "source": \
string (Name des Mediums), "publishedAt": string (Datum JJJJ-MM-TT)}
Nur echte, belegbare Meldungen aus den letzten 7 Tagen, keine Doppelungen, \
keine erfundenen URLs. 3-5 Einträge, die wichtigste zuerst.`;

async function hashId(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function parseArray(text: string): unknown[] {
  const cleaned = text
    .replace(/```json|```/g, "")
    // Quellen-Marker wie [3] oder [7][9] direkt hinter JSON-Werten entfernen,
    // sonst ist das JSON ungültig.
    .replace(/(["\d}\]])\s*(?:\[\d+\])+(?=\s*[,}\]\n])/g, "$1")
    .trim();
  // Erst ab "[ {" suchen: Steht vor dem JSON Text mit Markern wie "[1]",
  // würde ein einfaches /\[.*\]/ dort beginnen und das Parsen scheitern.
  const match = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Sonar hängt Quellen-Marker wie "[3]" oder "[7][9]" an; die brauchen wir nicht.
function stripCitations(text: string): string {
  return text.replace(/\s*(\[\d+\])+/g, "").trim();
}

function normalizeDate(value: unknown, fallback: string): string {
  const d = typeof value === "string" ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime()) || d.getTime() > Date.now()) return fallback;
  return d.toISOString();
}

async function fetchCategoryOnce(
  token: string,
  category: (typeof CATEGORIES)[number],
  nowIso: string
): Promise<NewsItem[]> {
  const today = nowIso.slice(0, 10);
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Heute ist ${today}. Bereich: ${category.label}. Themenfeld: ${category.focus} Liefere jetzt das JSON-Array.`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    if (res.status === 429) {
      const seconds = Number(body.match(/Retry after (\d+)s/)?.[1] ?? 30);
      throw new RateLimitError(Math.min(seconds, 60));
    }
    throw new Error(`AI Gateway ${res.status}: ${body}`);
  }
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";

  const items: NewsItem[] = [];
  const seen = new Set<string>();
  const entries = parseArray(text);
  if (entries.length === 0) {
    console.error(
      `Keine verwertbare Antwort für ${category.id}:`,
      text.slice(0, 600)
    );
  }
  for (const raw of entries) {
    const item = raw as Record<string, unknown>;
    const url = typeof item.url === "string" ? item.url : "";
    const title =
      typeof item.title === "string" ? stripCitations(item.title) : "";
    if (!title || !/^https?:\/\//.test(url) || seen.has(url)) continue;
    seen.add(url);
    items.push({
      id: `${category.id}-${await hashId(url)}`,
      categoryId: category.id,
      title: title.slice(0, 160),
      summary:
        typeof item.summary === "string" ? stripCitations(item.summary) : "",
      url,
      source: typeof item.source === "string" ? item.source : "",
      publishedAt: normalizeDate(item.publishedAt, nowIso),
      fetchedAt: nowIso,
    });
  }
  return items.slice(0, 5);
}

class RateLimitError extends Error {
  readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super(`Rate-Limit, erneut in ${retryAfterSeconds}s`);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Höchstens zwei Versuche: neu fragen, wenn das Modell kein verwertbares
// JSON liefert, und nach einem Rate-Limit (429) die genannte Zeit warten.
async function fetchCategory(
  token: string,
  category: (typeof CATEGORIES)[number],
  nowIso: string
): Promise<NewsItem[]> {
  for (let attempt = 1; ; attempt++) {
    try {
      const items = await fetchCategoryOnce(token, category, nowIso);
      if (items.length > 0 || attempt >= 2) return items;
    } catch (e) {
      if (attempt >= 2) throw e;
      if (e instanceof RateLimitError) {
        await sleep(e.retryAfterSeconds * 1000);
      } else {
        throw e;
      }
    }
  }
}

interface Snapshot {
  fetchedAt: string;
  byCategory: Partial<Record<string, NewsItem[]>>;
}

const SNAPSHOT_KEY = "news:snapshot:v1";
const LOCK_KEY = "news:refresh-lock:v1";
const FRESH_MS = 6 * 60 * 60 * 1000;
const FRESH_INCOMPLETE_MS = 15 * 60 * 1000;
const SNAPSHOT_TTL_S = 14 * 24 * 60 * 60;
const LOCK_TTL_S = 5 * 60;

async function refreshSnapshot(previous: Snapshot | null): Promise<void> {
  const cache = getCache();
  const nowIso = new Date().toISOString();
  let token: string;
  try {
    token = await getVercelOidcToken();
  } catch (e) {
    console.error("Kein OIDC-Token verfügbar:", e);
    await cache.delete(LOCK_KEY);
    return;
  }

  const byCategory: Snapshot["byCategory"] = { ...previous?.byCategory };
  const failed: string[] = [];
  // Nacheinander, damit ein Abruf unter dem Limit von 5 Anfragen/Minute bleibt.
  for (const c of CATEGORIES) {
    try {
      const items = await fetchCategory(token, c, nowIso);
      if (items.length) byCategory[c.id] = items;
      else failed.push(c.id);
    } catch (e) {
      failed.push(c.id);
      console.error(`News für ${c.id} fehlgeschlagen:`, e);
    }
  }

  if (failed.length < CATEGORIES.length) {
    await cache.set(
      SNAPSHOT_KEY,
      { fetchedAt: nowIso, byCategory } satisfies Snapshot,
      { ttl: SNAPSHOT_TTL_S, name: "ToolPulse News" }
    );
  }
  if (failed.length) console.error("Keine neuen News für:", failed.join(", "));
  await cache.delete(LOCK_KEY);
}

export async function GET(): Promise<Response> {
  const cache = getCache();
  const snapshot = (await cache.get(SNAPSHOT_KEY)) as Snapshot | null;
  const incomplete = CATEGORIES.some(
    (c) => !snapshot?.byCategory[c.id]?.length
  );
  const maxAge = incomplete ? FRESH_INCOMPLETE_MS : FRESH_MS;
  const isFresh =
    snapshot !== null &&
    Date.now() - new Date(snapshot.fetchedAt).getTime() < maxAge;

  let refreshing = false;
  if (!isFresh) {
    const locked = await cache.get(LOCK_KEY);
    if (locked === null) {
      await cache.set(LOCK_KEY, new Date().toISOString(), { ttl: LOCK_TTL_S });
      waitUntil(refreshSnapshot(snapshot));
    }
    refreshing = true;
  }

  const news = Object.values(snapshot?.byCategory ?? {}).flatMap(
    (items) => items ?? []
  );
  return Response.json(
    { fetchedAt: snapshot?.fetchedAt ?? null, refreshing, news },
    {
      headers: {
        "Cache-Control": "public, max-age=0",
        // Kurz im CDN halten; die eigentliche Haltbarkeit regelt der Snapshot.
        "CDN-Cache-Control": refreshing
          ? "public, s-maxage=30"
          : "public, s-maxage=600",
      },
    }
  );
}
