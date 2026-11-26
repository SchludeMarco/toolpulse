/**
 * Gemeinsame Bausteine für /api/news und /api/tools.
 *
 * Beide fragen über das Vercel AI Gateway das Suchmodell Perplexity Sonar
 * (Authentifizierung per OIDC-Token des Projekts, kein eigener API-Key).
 * Das Modell erlaubt nur 5 Anfragen pro Minute. Deshalb löst ein
 * Seitenaufruf nie selbst eine Suche aus: Ausgeliefert wird immer der
 * zuletzt gespeicherte Stand aus dem Vercel Runtime Cache. Ist er veraltet,
 * startet genau ein Abruf im Hintergrund. News und Tools teilen sich eine
 * Sperre, damit nie beide gleichzeitig suchen.
 */
import { getVercelOidcToken } from "@vercel/oidc";
import { getCache, waitUntil } from "@vercel/functions";

const MODEL = "perplexity/sonar";
const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";
const LOCK_KEY = "sonar:refresh-lock:v1";
const LOCK_TTL_S = 8 * 60;

// Muss zu den IDs in src/data/categories.ts passen.
export const CATEGORIES = [
  {
    id: "llm",
    label: "Beste LLMs",
    newsFocus:
      "Sprachmodelle und KI-Assistenten: neue Modell-Releases und Updates von Anthropic, OpenAI, Google, Meta, Mistral, DeepSeek u.a., Benchmarks, Preise, Open-Weights-Modelle.",
    toolFocus:
      "Sprachmodelle und Chat-Assistenten. Stütze dich auf Leaderboards und Vergleiche (z.B. LMArena, Artificial Analysis, offizielle Modell-Ankündigungen, Hacker News, Reddit r/LocalLLaMA) statt auf Marketingtexte. Nenne bei jedem Eintrag, worin er sich abhebt (z.B. Coding, Kontextlänge, Kosten, Open Weights).",
  },
  {
    id: "ki-bild",
    label: "KI-Bildgenerierung",
    newsFocus:
      "KI-Bild- und Videogenerierung: Midjourney, ChatGPT/GPT-Image, Gemini/Imagen, FLUX, Stable Diffusion, Ideogram, Runway u.a. – neue Versionen, Features, Rechtliches.",
    toolFocus:
      "Modelle und Tools zum Erzeugen und Bearbeiten von Bildern per KI (z.B. Midjourney, ChatGPT-Bildgenerierung, Gemini, FLUX, Stable Diffusion, Ideogram). Nenne bei jedem Eintrag, worin er sich abhebt (z.B. Fotorealismus, Text im Bild, Bildbearbeitung, Open Source).",
  },
  {
    id: "dev-trends",
    label: "Dev-Trends",
    newsFocus:
      "Softwareentwicklung: Frameworks, Sprachen, Libraries, Build-Tools, KI-Coding-Assistenten, wichtige Releases und Sicherheitsvorfälle (GitHub, Hacker News, dev.to).",
    toolFocus:
      "Frameworks, Sprachen, Libraries, Build-Tools und KI-Coding-Assistenten, die gerade an Fahrt gewinnen. Nutze Entwicklerportale wie GitHub Trending, Hacker News, dev.to, Product Hunt und Stack Overflow.",
  },
  {
    id: "design-trends",
    label: "Design-Trends",
    newsFocus:
      "UI/UX- und Webdesign: Design-Tools (Figma, Framer, Adobe u.a.), KI im Design, neue Features und Trends (Awwwards, Smashing Magazine, Dribbble).",
    toolFocus:
      "Design- und UI/UX-Tools und die Trends dahinter. Nutze Designerportale wie Awwwards, Dribbble, Behance, Smashing Magazine und Muzli. Nenne bei jedem Eintrag den erkennbaren Trend (z.B. Bento-Grids, KI-gestütztes Prototyping).",
  },
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface Snapshot<T> {
  fetchedAt: string;
  byCategory: Partial<Record<string, T[]>>;
}

export async function hashId(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  return [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function parseArray(text: string): unknown[] {
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
export function stripCitations(text: string): string {
  return text.replace(/\s*(\[\d+\])+/g, "").trim();
}

export function normalizeDate(value: unknown, fallback: string): string {
  const d = typeof value === "string" ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime()) || d.getTime() > Date.now()) return fallback;
  return d.toISOString();
}

export const str = (v: unknown): string => (typeof v === "string" ? v : "");

class RateLimitError extends Error {
  readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super(`Rate-Limit, erneut in ${retryAfterSeconds}s`);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function askOnce(
  token: string,
  system: string,
  user: string,
  maxTokens: number
): Promise<string> {
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
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
  return data?.choices?.[0]?.message?.content ?? "";
}

/**
 * Fragt Sonar und wandelt die Antwort in Einträge um. Höchstens zwei
 * Versuche: erneut, wenn nichts Verwertbares kam, und nach einem
 * Rate-Limit (429) erst nach der genannten Wartezeit.
 */
export async function askForItems<T>(
  token: string,
  label: string,
  system: string,
  user: string,
  maxTokens: number,
  toItems: (raw: unknown[]) => Promise<T[]>
): Promise<T[]> {
  for (let attempt = 1; ; attempt++) {
    try {
      const text = await askOnce(token, system, user, maxTokens);
      const items = await toItems(parseArray(text));
      if (items.length > 0) return items;
      console.error(`Keine verwertbare Antwort für ${label}:`, text.slice(0, 600));
      if (attempt >= 2) return [];
    } catch (e) {
      if (attempt >= 2 || !(e instanceof RateLimitError)) throw e;
      await sleep(e.retryAfterSeconds * 1000);
    }
  }
}

/**
 * Liefert den gespeicherten Stand sofort aus und stößt bei Bedarf genau
 * einen Hintergrund-Abruf an. `fetchCategory` liefert die neuen Einträge
 * eines Bereichs; `merge` verbindet sie mit den bisherigen.
 */
export async function serveSnapshot<T>(options: {
  key: string;
  freshMs: number;
  incompleteMs: number;
  fetchCategory: (token: string, c: Category, nowIso: string, previous: T[]) => Promise<T[]>;
  merge: (previous: T[], fresh: T[]) => T[];
}): Promise<{ fetchedAt: string | null; refreshing: boolean; items: T[] }> {
  const cache = getCache();
  const snapshot = (await cache.get(options.key)) as Snapshot<T> | null;
  const incomplete = CATEGORIES.some((c) => !snapshot?.byCategory[c.id]?.length);
  const maxAge = incomplete ? options.incompleteMs : options.freshMs;
  const isFresh =
    snapshot !== null &&
    Date.now() - new Date(snapshot.fetchedAt).getTime() < maxAge;

  if (!isFresh && (await cache.get(LOCK_KEY)) === null) {
    await cache.set(LOCK_KEY, new Date().toISOString(), { ttl: LOCK_TTL_S });
    waitUntil(refresh(options, snapshot));
  }

  return {
    fetchedAt: snapshot?.fetchedAt ?? null,
    refreshing: !isFresh,
    items: Object.values(snapshot?.byCategory ?? {}).flatMap((x) => x ?? []),
  };
}

async function refresh<T>(
  options: Parameters<typeof serveSnapshot<T>>[0],
  previous: Snapshot<T> | null
): Promise<void> {
  const cache = getCache();
  try {
    const token = await getVercelOidcToken();
    const nowIso = new Date().toISOString();
    const byCategory: Snapshot<T>["byCategory"] = { ...previous?.byCategory };
    const failed: string[] = [];
    // Nacheinander, damit ein Abruf unter 5 Anfragen pro Minute bleibt.
    for (const c of CATEGORIES) {
      const before = byCategory[c.id] ?? [];
      try {
        const fresh = await options.fetchCategory(token, c, nowIso, before);
        if (fresh.length) byCategory[c.id] = options.merge(before, fresh);
        else failed.push(c.id);
      } catch (e) {
        failed.push(c.id);
        console.error(`${options.key}: ${c.id} fehlgeschlagen:`, e);
      }
    }
    if (failed.length < CATEGORIES.length) {
      await cache.set(
        options.key,
        { fetchedAt: nowIso, byCategory } satisfies Snapshot<T>,
        { ttl: 30 * 24 * 60 * 60, name: options.key }
      );
    }
    if (failed.length) console.error(`${options.key}: nichts Neues für`, failed.join(", "));
  } catch (e) {
    console.error(`${options.key}: Abruf fehlgeschlagen:`, e);
  } finally {
    await cache.delete(LOCK_KEY);
  }
}

export function jsonResponse(body: unknown, refreshing: boolean, cdnSeconds: number): Response {
  return Response.json(body, {
    headers: {
      "Cache-Control": "public, max-age=0",
      "CDN-Cache-Control": `public, s-maxage=${refreshing ? 30 : cdnSeconds}`,
    },
  });
}
