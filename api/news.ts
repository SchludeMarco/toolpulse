/**
 * GET /api/news — aktuelle News pro Bereich (die wichtigsten Meldungen der
 * letzten 7 Tage). Stand alle 6 Stunden im Hintergrund erneuert, siehe
 * api/_lib/sonar.ts.
 */
import {
  askForItems,
  hashId,
  jsonResponse,
  normalizeDate,
  serveSnapshot,
  str,
  stripCitations,
  type Category,
} from "./_lib/sonar.js";

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

async function fetchCategory(
  token: string,
  c: Category,
  nowIso: string
): Promise<NewsItem[]> {
  return askForItems(
    token,
    `News ${c.id}`,
    SYSTEM_PROMPT,
    `Heute ist ${nowIso.slice(0, 10)}. Bereich: ${c.label}. Themenfeld: ${c.newsFocus} Liefere jetzt das JSON-Array.`,
    2000,
    async (raw) => {
      const items: NewsItem[] = [];
      const seen = new Set<string>();
      for (const entry of raw) {
        const item = (entry ?? {}) as Record<string, unknown>;
        const url = str(item.url);
        const title = stripCitations(str(item.title));
        if (!title || !/^https?:\/\//.test(url) || seen.has(url)) continue;
        seen.add(url);
        items.push({
          id: `${c.id}-${await hashId(url)}`,
          categoryId: c.id,
          title: title.slice(0, 160),
          summary: stripCitations(str(item.summary)),
          url,
          source: str(item.source),
          publishedAt: normalizeDate(item.publishedAt, nowIso),
          fetchedAt: nowIso,
        });
      }
      return items.slice(0, 5);
    }
  );
}

export async function GET(): Promise<Response> {
  const { fetchedAt, refreshing, items } = await serveSnapshot<NewsItem>({
    key: "news:snapshot:v1",
    freshMs: 6 * 60 * 60 * 1000,
    incompleteMs: 15 * 60 * 1000,
    fetchCategory,
    // News eines Bereichs werden komplett durch die neuen ersetzt.
    merge: (_previous, fresh) => fresh,
  });
  return jsonResponse({ fetchedAt, refreshing, news: items }, refreshing, 600);
}
