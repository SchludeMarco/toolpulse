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

type CategoryId = (typeof CATEGORIES)[number]["id"];

const SYSTEM_PROMPT = `Du bist ein sorgfältiger Tech-Redakteur. Recherchiere per \
Websuche die wichtigsten Nachrichten der letzten 7 Tage zu jedem der genannten \
Bereiche. Antworte AUSSCHLIESSLICH mit einem JSON-Objekt ohne Markdown und ohne \
Erklärtext. Die Schlüssel sind die Bereichs-IDs, die Werte jeweils ein Array \
mit Elementen genau dieser Form:
{"title": string (max. 100 Zeichen, Deutsch), "summary": string (1-2 Sätze, \
Deutsch, sachlich), "url": string (direkter Link auf den Artikel), "source": \
string (Name des Mediums), "publishedAt": string (Datum JJJJ-MM-TT)}
Nur echte, belegbare Meldungen aus den letzten 7 Tagen, keine Doppelungen, \
keine erfundenen URLs. 3-5 Einträge pro Bereich, die wichtigste zuerst.`;

async function hashId(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function parseObject(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    const parsed = JSON.parse(match[0]);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
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

class RateLimitError extends Error {
  readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super(`Rate-Limit, erneut in ${retryAfterSeconds}s`);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function toItems(
  categoryId: CategoryId,
  raw: unknown,
  nowIso: string
): Promise<NewsItem[]> {
  if (!Array.isArray(raw)) return [];
  const items: NewsItem[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const item = (entry ?? {}) as Record<string, unknown>;
    const url = typeof item.url === "string" ? item.url : "";
    const title =
      typeof item.title === "string" ? stripCitations(item.title) : "";
    if (!title || !/^https?:\/\//.test(url) || seen.has(url)) continue;
    seen.add(url);
    items.push({
      id: `${categoryId}-${await hashId(url)}`,
      categoryId,
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

// Eine einzige Anfrage für alle übergebenen Bereiche: das Suchmodell erlaubt
// nur wenige Anfragen pro Minute, so bleibt ein Abruf weit darunter.
async function fetchOnce(
  token: string,
  categories: readonly (typeof CATEGORIES)[number][],
  nowIso: string
): Promise<Map<CategoryId, NewsItem[]>> {
  const today = nowIso.slice(0, 10);
  const list = categories
    .map((c) => `- ${c.id} (${c.label}): ${c.focus}`)
    .join("\n");
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 6000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Heute ist ${today}. Bereiche:\n${list}\nLiefere jetzt das JSON-Objekt mit den Schlüsseln ${categories
            .map((c) => `"${c.id}"`)
            .join(", ")}.`,
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
  const parsed = parseObject(data?.choices?.[0]?.message?.content ?? "");

  const result = new Map<CategoryId, NewsItem[]>();
  for (const c of categories) {
    result.set(c.id, await toItems(c.id, parsed[c.id], nowIso));
  }
  return result;
}

// Höchstens zwei Anfragen: die zweite nur für Bereiche ohne Ergebnis, nach
// einem Rate-Limit (429) erst nach der genannten Wartezeit.
async function fetchAll(
  token: string,
  nowIso: string
): Promise<Map<CategoryId, NewsItem[]>> {
  const result = new Map<CategoryId, NewsItem[]>();
  let pending: readonly (typeof CATEGORIES)[number][] = CATEGORIES;
  for (let attempt = 1; attempt <= 2 && pending.length > 0; attempt++) {
    try {
      const batch = await fetchOnce(token, pending, nowIso);
      for (const [id, items] of batch) {
        if (items.length > 0) result.set(id, items);
      }
    } catch (e) {
      console.error(`News-Abruf (Versuch ${attempt}) fehlgeschlagen:`, e);
      if (attempt >= 2) break;
      if (e instanceof RateLimitError) await sleep(e.retryAfterSeconds * 1000);
    }
    pending = pending.filter((c) => !result.has(c.id));
  }
  return result;
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

  const byCategory = await fetchAll(token, nowIso);
  const news: NewsItem[] = [];
  const failed: string[] = [];
  for (const c of CATEGORIES) {
    const items = byCategory.get(c.id);
    if (items?.length) news.push(...items);
    else failed.push(c.id);
  }
  if (failed.length) console.error("Keine News für:", failed.join(", "));

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
        "Cache-Control": "public, max-age=0",
        // Vollständig: 6 h frisch im CDN, danach bis zu 24 h veraltet
        // ausliefern und im Hintergrund neu laden. Fehlt ein Bereich, nur
        // 5 Minuten cachen, damit er bald nachgeladen wird.
        "CDN-Cache-Control":
          failed.length === 0
            ? "public, s-maxage=21600, stale-while-revalidate=86400"
            : "public, s-maxage=300",
      },
    }
  );
}
