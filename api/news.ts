/**
 * GET /api/news — aktuelle News pro Bereich.
 *
 * Läuft als Vercel Function und fragt per Vercel AI Gateway ein Modell mit
 * eingebauter Websuche (Perplexity Sonar) nach den wichtigsten Meldungen der
 * letzten 7 Tage. Authentifizierung über das OIDC-Token des Projekts, also
 * ohne eigenen API-Key. Die Antwort wird 6 Stunden im Vercel-CDN gecacht,
 * damit nicht jeder Seitenaufruf eine Suche auslöst.
 */
import { getVercelOidcToken } from "@vercel/oidc";

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
  const cleaned = text.replace(/```json|```/g, "").trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeDate(value: unknown, fallback: string): string {
  const d = typeof value === "string" ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime()) || d.getTime() > Date.now()) return fallback;
  return d.toISOString();
}

async function fetchCategory(
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
    throw new Error(`AI Gateway ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";

  const items: NewsItem[] = [];
  const seen = new Set<string>();
  for (const raw of parseArray(text)) {
    const item = raw as Record<string, unknown>;
    const url = typeof item.url === "string" ? item.url : "";
    const title = typeof item.title === "string" ? item.title.trim() : "";
    if (!title || !/^https?:\/\//.test(url) || seen.has(url)) continue;
    seen.add(url);
    items.push({
      id: `${category.id}-${await hashId(url)}`,
      categoryId: category.id,
      title: title.slice(0, 160),
      summary: typeof item.summary === "string" ? item.summary : "",
      url,
      source: typeof item.source === "string" ? item.source : "",
      publishedAt: normalizeDate(item.publishedAt, nowIso),
      fetchedAt: nowIso,
    });
  }
  return items.slice(0, 5);
}

export async function GET(): Promise<Response> {
  const nowIso = new Date().toISOString();
  let token: string;
  try {
    token = await getVercelOidcToken();
  } catch (e) {
    console.error("Kein OIDC-Token verfügbar:", e);
    return Response.json(
      { error: "News sind nur auf Vercel verfügbar." },
      { status: 503 }
    );
  }

  const results = await Promise.allSettled(
    CATEGORIES.map((c) => fetchCategory(token, c, nowIso))
  );
  const news: NewsItem[] = [];
  const failed: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") news.push(...r.value);
    else {
      failed.push(CATEGORIES[i].id);
      console.error(`News für ${CATEGORIES[i].id} fehlgeschlagen:`, r.reason);
    }
  });

  // Komplett fehlgeschlagen: nicht cachen, damit der nächste Aufruf es neu versucht.
  if (news.length === 0 && failed.length > 0) {
    return Response.json(
      { error: "News konnten nicht geladen werden.", failed },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }

  return Response.json(
    { fetchedAt: nowIso, news, failed },
    {
      headers: {
        // 6 h frisch im CDN, danach bis zu 24 h veraltet ausliefern und im
        // Hintergrund neu laden.
        "Cache-Control": "public, max-age=0",
        "CDN-Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
      },
    }
  );
}
