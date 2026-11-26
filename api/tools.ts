/**
 * GET /api/tools — kuratierte Tools pro Bereich (ersetzt die tägliche
 * Firebase Cloud Function). Der Stand wird einmal pro Tag im Hintergrund
 * erneuert, siehe api/_lib/sonar.ts. Neue Funde werden mit den bisherigen
 * zusammengeführt; "firstSeen" bleibt erhalten, "lastUpdated" wird bei
 * jedem erneuten Fund aktualisiert.
 */
import {
  askForItems,
  jsonResponse,
  serveSnapshot,
  slugify,
  str,
  stripCitations,
  type Category,
} from "./_lib/sonar.js";

type PriceTier = "kostenlos" | "freemium" | "abo" | "einmalig";
const PRICE_TIERS: PriceTier[] = ["kostenlos", "freemium", "abo", "einmalig"];

interface Tool {
  id: string;
  name: string;
  categoryId: string;
  tagline: string;
  description: string;
  url: string;
  priceTier: PriceTier;
  priceDetail?: string;
  trustScore: number;
  sources: { name: string; url: string }[];
  firstSeen: string;
  lastUpdated: string;
  isNew?: boolean;
  tags: string[];
}

// Höchstens so viele Tools pro Bereich behalten (die zuletzt gefundenen).
const MAX_PER_CATEGORY = 40;

const SYSTEM_PROMPT = `Du bist ein sorgfältiger Produkt-Scout. Recherchiere per \
Websuche die aktuell besten, real existierenden Tools, Apps, Modelle oder \
Dienste für den genannten Bereich. Antworte AUSSCHLIESSLICH mit einem \
JSON-Array ohne Markdown und ohne Erklärtext. Jedes Element hat exakt diese \
Felder:
{"name": string, "tagline": string (max. 80 Zeichen, Deutsch), \
"description": string (2-3 Sätze, Deutsch, sachlich), "url": string \
(offizielle Website), "priceTier": "kostenlos" | "freemium" | "abo" | \
"einmalig", "priceDetail": string | null, "sources": [{"name": string, \
"url": string}] (mind. 1 echte Quelle), "tags": string[]}
Nur Tools, die du per Websuche verifizieren konntest, keine erfundenen URLs. \
Bevorzuge Tools mit Neuigkeiten oder Relevanz in den letzten Tagen, nenne aber \
auch bewährte Klassiker, falls nichts Neues auffindbar ist. 4-6 Einträge.`;

// Wie in der bisherigen Cloud Function: mehr Quellen = höherer Score.
function trustScore(sourceCount: number): number {
  return Math.min(55 + Math.min(sourceCount * 12, 36), 95);
}

async function fetchCategory(
  token: string,
  c: Category,
  nowIso: string,
  previous: Tool[]
): Promise<Tool[]> {
  const known = new Map(previous.map((t) => [t.id, t]));
  return askForItems(
    token,
    `Tools ${c.id}`,
    SYSTEM_PROMPT,
    `Heute ist ${nowIso.slice(0, 10)}. Bereich: ${c.label}. Fokus: ${c.toolFocus} Liefere jetzt das JSON-Array.`,
    4000,
    async (raw) => {
      const items: Tool[] = [];
      const seen = new Set<string>();
      for (const entry of raw) {
        const item = (entry ?? {}) as Record<string, unknown>;
        const name = stripCitations(str(item.name));
        const url = str(item.url);
        if (!name || !/^https?:\/\//.test(url)) continue;
        const id = `${c.id}-${slugify(name)}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const sources = (Array.isArray(item.sources) ? item.sources : [])
          .map((s) => (s ?? {}) as Record<string, unknown>)
          .filter((s) => /^https?:\/\//.test(str(s.url)))
          .map((s) => ({ name: str(s.name) || new URL(str(s.url)).hostname, url: str(s.url) }));
        const priceTier = PRICE_TIERS.includes(item.priceTier as PriceTier)
          ? (item.priceTier as PriceTier)
          : "freemium";
        items.push({
          id,
          name: name.slice(0, 80),
          categoryId: c.id,
          tagline: stripCitations(str(item.tagline)).slice(0, 120),
          description: stripCitations(str(item.description)),
          url,
          priceTier,
          ...(str(item.priceDetail) ? { priceDetail: stripCitations(str(item.priceDetail)) } : {}),
          trustScore: trustScore(sources.length),
          sources,
          firstSeen: known.get(id)?.firstSeen ?? nowIso,
          lastUpdated: nowIso,
          isNew: !known.has(id),
          tags: (Array.isArray(item.tags) ? item.tags : []).map(str).filter(Boolean).slice(0, 6),
        });
      }
      return items;
    }
  );
}

function merge(previous: Tool[], fresh: Tool[]): Tool[] {
  const freshIds = new Set(fresh.map((t) => t.id));
  const older = previous
    .filter((t) => !freshIds.has(t.id))
    .map((t) => ({ ...t, isNew: false }));
  return [...fresh, ...older]
    .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated))
    .slice(0, MAX_PER_CATEGORY);
}

export async function GET(): Promise<Response> {
  const { fetchedAt, refreshing, items } = await serveSnapshot<Tool>({
    key: "tools:snapshot:v1",
    freshMs: 24 * 60 * 60 * 1000,
    incompleteMs: 30 * 60 * 1000,
    fetchCategory,
    merge,
  });
  return jsonResponse({ fetchedAt, refreshing, tools: items }, refreshing, 600);
}
