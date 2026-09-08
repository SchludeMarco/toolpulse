import { useEffect, useState, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, isDemoMode } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import type { UserPreferences, CategoryId } from "../types";
import { categories } from "../data/categories";

const defaultPrefs = (uid: string): UserPreferences => ({
  uid,
  categoryWeights: categories.reduce(
    (acc, c) => ({ ...acc, [c.id]: 2 }),
    {} as Record<CategoryId, number>
  ),
  priceFilter: [],
  minTrustScore: 0,
  digestFrequency: "täglich",
  updatedAt: new Date().toISOString(),
});

const localKey = (uid: string) => `toolpulse:prefs:${uid}`;

export function usePreferences() {
  const { user } = useAuth();
  const uid = user?.uid ?? "anon";
  const [prefs, setPrefs] = useState<UserPreferences>(defaultPrefs(uid));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (isDemoMode || !db) {
        const raw = localStorage.getItem(localKey(uid));
        if (!cancelled) {
          setPrefs(raw ? JSON.parse(raw) : defaultPrefs(uid));
          setLoading(false);
        }
        return;
      }
      const snap = await getDoc(doc(db, "userPreferences", uid));
      if (cancelled) return;
      setPrefs(snap.exists() ? (snap.data() as UserPreferences) : defaultPrefs(uid));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const save = useCallback(
    async (next: UserPreferences) => {
      setPrefs(next);
      if (isDemoMode || !db) {
        localStorage.setItem(localKey(uid), JSON.stringify(next));
        return;
      }
      await setDoc(doc(db, "userPreferences", uid), next);
    },
    [uid]
  );

  return { prefs, setPrefs: save, loading };
}
