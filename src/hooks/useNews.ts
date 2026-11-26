import { useCallback, useEffect, useRef, useState } from "react";
import type { NewsItem } from "../types";

// Die News kommen von der Vercel Function /api/news (Websuche über das
// Vercel AI Gateway) und nicht aus Firestore. Meldet die Function, dass sie
// gerade im Hintergrund aktualisiert, fragen wir nach kurzer Zeit noch
// einmal nach (höchstens ein paar Mal).
const RETRY_DELAY_MS = 40_000;
const MAX_RETRIES = 4;
export function useNews() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const retries = useRef(0);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/news");
      if (!res.ok) throw new Error(`News nicht verfügbar (${res.status}).`);
      const data = (await res.json()) as {
        news?: NewsItem[];
        refreshing?: boolean;
      };
      const items = data.news ?? [];
      setRefreshing(!!data.refreshing);
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

  useEffect(() => {
    if (!refreshing || retries.current >= MAX_RETRIES) return;
    const timer = setTimeout(() => {
      retries.current += 1;
      fetchNews();
    }, RETRY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [refreshing, news, fetchNews]);

  return { news, loading, refreshing, error, refetch: fetchNews };
}
