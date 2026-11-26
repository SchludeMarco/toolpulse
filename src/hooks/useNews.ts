import { useCallback, useEffect, useState } from "react";
import type { NewsItem } from "../types";

// Die News kommen von der Vercel Function /api/news (Websuche über das
// Vercel AI Gateway, im CDN gecacht) und nicht aus Firestore.
export function useNews() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/news");
      if (!res.ok) throw new Error(`News nicht verfügbar (${res.status}).`);
      const data = (await res.json()) as { news?: NewsItem[] };
      const items = data.news ?? [];
      items.sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
      setNews(items);
    } catch (e) {
      console.error("News konnten nicht geladen werden:", e);
      setError(e instanceof Error ? e.message : "News nicht verfügbar.");
      setNews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  return { news, loading, error, refetch: fetchNews };
}
