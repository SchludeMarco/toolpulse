import { useEffect, useState, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, isDemoMode } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import type { FavoriteEntry } from "../types";

const localKey = (uid: string) => `toolpulse:favorites:${uid}`;

export function useFavorites() {
  const { user } = useAuth();
  const uid = user?.uid ?? "anon";
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (isDemoMode || !db) {
        const raw = localStorage.getItem(localKey(uid));
        if (!cancelled) {
          setFavorites(raw ? JSON.parse(raw) : []);
          setLoading(false);
        }
        return;
      }
      const snap = await getDoc(doc(db, "favorites", uid));
      if (cancelled) return;
      setFavorites(snap.exists() ? (snap.data().items as FavoriteEntry[]) : []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const persist = useCallback(
    async (next: FavoriteEntry[]) => {
      setFavorites(next);
      if (isDemoMode || !db) {
        localStorage.setItem(localKey(uid), JSON.stringify(next));
        return;
      }
      await setDoc(doc(db, "favorites", uid), { items: next });
    },
    [uid]
  );

  const toggleFavorite = useCallback(
    (toolId: string) => {
      const exists = favorites.some((f) => f.toolId === toolId);
      if (exists) {
        persist(favorites.filter((f) => f.toolId !== toolId));
      } else {
        const reviewAt = new Date();
        reviewAt.setDate(reviewAt.getDate() + 30);
        persist([
          ...favorites,
          {
            toolId,
            addedAt: new Date().toISOString(),
            reviewAt: reviewAt.toISOString(),
          },
        ]);
      }
    },
    [favorites, persist]
  );

  return { favorites, toggleFavorite, loading };
}
