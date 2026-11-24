import { useCallback, useEffect, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db, isDemoMode } from "../lib/firebase";
import type { NewsItem } from "../types";

// Nur Meldungen der letzten 14 Tage anzeigen; ältere räumt die Cloud
// Function nach 30 Tagen ohnehin weg.
const MAX_AGE_DAYS = 14;

export function useNews() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(!isDemoMode);

  const fetchNews = useCallback(async () => {
    if (isDemoMode || !db) return;
    setLoading(true);
    try {
      const cutoff = new Date(
        Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000
      ).toISOString();
      const q = query(
        collection(db, "news"),
        where("publishedAt", ">=", cutoff),
        orderBy("publishedAt", "desc")
      );
      const snap = await getDocs(q);
      setNews(snap.docs.map((d) => d.data() as NewsItem));
    } catch (e) {
      console.error("News konnten nicht aus Firestore geladen werden:", e);
      setNews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  return { news, loading, refetch: fetchNews };
}
