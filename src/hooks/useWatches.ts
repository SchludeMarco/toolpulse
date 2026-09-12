import { useEffect, useState, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, isDemoMode } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import type { CategoryId, Watch } from "../types";

const localKey = (uid: string) => `toolpulse:watches:${uid}`;

export function useWatches() {
  const { user } = useAuth();
  const uid = user?.uid ?? "anon";
  const [watches, setWatches] = useState<Watch[]>([]);
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
          setWatches(raw ? JSON.parse(raw) : []);
          setLoading(false);
        }
        return;
      }
      try {
        const snap = await getDoc(doc(db!, "watches", uid));
        if (cancelled) return;
        setWatches(snap.exists() ? (snap.data().items as Watch[]) : []);
      } catch (e) {
        console.error("Beobachtungen konnten nicht geladen werden:", e);
        if (!cancelled) setWatches([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, useFirestore]);

  const persist = useCallback(
    async (next: Watch[]) => {
      setWatches(next);
      if (!useFirestore) {
        localStorage.setItem(localKey(uid), JSON.stringify(next));
        return;
      }
      try {
        await setDoc(doc(db!, "watches", uid), { items: next });
        setSaveError(null);
      } catch (e) {
        console.error("Beobachtungen konnten nicht gespeichert werden:", e);
        setSaveError(
          e instanceof Error ? e.message : "Speichern fehlgeschlagen."
        );
      }
    },
    [uid, useFirestore]
  );

  const addWatch = useCallback(
    (categoryId: CategoryId, query: string) => {
      const trimmed = query.trim();
      if (!trimmed) return;
      const watch: Watch = {
        id: crypto.randomUUID(),
        categoryId,
        query: trimmed,
        active: true,
        createdAt: new Date().toISOString(),
      };
      persist([watch, ...watches]);
    },
    [watches, persist]
  );

  const toggleActive = useCallback(
    (id: string) => {
      persist(
        watches.map((w) => (w.id === id ? { ...w, active: !w.active } : w))
      );
    },
    [watches, persist]
  );

  const deleteWatch = useCallback(
    (id: string) => {
      persist(watches.filter((w) => w.id !== id));
    },
    [watches, persist]
  );

  return { watches, addWatch, toggleActive, deleteWatch, loading, saveError };
}
