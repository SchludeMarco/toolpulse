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
  const [saveError, setSaveError] = useState<string | null>(null);

  const useFirestore = !isDemoMode && !!db && !!user;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (!useFirestore) {
        const raw = localStorage.getItem(localKey(uid));
        if (!cancelled) {
          setFavorites(raw ? JSON.parse(raw) : []);
          setLoading(false);
        }
        return;
      }
      try {
        const snap = await getDoc(doc(db!, "favorites", uid));
        if (cancelled) return;
        setFavorites(snap.exists() ? (snap.data().items as FavoriteEntry[]) : []);
      } catch (e) {
        console.error("Merkliste konnte nicht geladen werden:", e);
        if (!cancelled) setFavorites([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, useFirestore]);

  const persist = useCallback(
    async (next: FavoriteEntry[]) => {
      setFavorites(next);
      if (!useFirestore) {
        localStorage.setItem(localKey(uid), JSON.stringify(next));
        return;
      }
      try {
        await setDoc(doc(db!, "favorites", uid), { items: next });
        setSaveError(null);
      } catch (e) {
        console.error("Merkliste konnte nicht gespeichert werden:", e);
        setSaveError(
          e instanceof Error ? e.message : "Speichern fehlgeschlagen."
        );
      }
    },
    [uid, useFirestore]
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

  return { favorites, toggleFavorite, loading, saveError };
}
