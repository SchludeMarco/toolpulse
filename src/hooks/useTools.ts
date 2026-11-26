import { useCallback, useEffect, useRef, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db, isDemoMode } from "../lib/firebase";
import { seedTools } from "../data/seedTools";
import type { Tool } from "../types";

// Tools kommen aus zwei Quellen:
// - /api/tools (Vercel): die laufende Kuratierung, einmal täglich erneuert
// - Firestore: die Funde der früheren Firebase-Kuratierung (Archiv)
// Beide werden nach ID zusammengeführt; bei Doppelungen gewinnt der neuere
// Fund. Meldet /api/tools, dass gerade im Hintergrund gesucht wird, fragen
// wir nach kurzer Zeit noch einmal nach.
const RETRY_DELAY_MS = 45_000;
const MAX_RETRIES = 4;

async function fetchVercelTools(): Promise<{ tools: Tool[]; refreshing: boolean }> {
  try {
    const res = await fetch("/api/tools");
    if (!res.ok) return { tools: [], refreshing: false };
    const data = (await res.json()) as { tools?: Tool[]; refreshing?: boolean };
    return { tools: data.tools ?? [], refreshing: !!data.refreshing };
  } catch (e) {
    console.error("Tools von /api/tools konnten nicht geladen werden:", e);
    return { tools: [], refreshing: false };
  }
}

async function fetchFirestoreTools(): Promise<Tool[]> {
  if (isDemoMode || !db) return [];
  try {
    const q = query(collection(db, "tools"), orderBy("lastUpdated", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as Tool);
  } catch (e) {
    console.error("Tools konnten nicht aus Firestore geladen werden:", e);
    return [];
  }
}

function mergeTools(lists: Tool[][]): Tool[] {
  const byId = new Map<string, Tool>();
  for (const t of lists.flat()) {
    const existing = byId.get(t.id);
    if (!existing) {
      byId.set(t.id, t);
    } else if (t.lastUpdated > existing.lastUpdated) {
      // Neuerer Fund gewinnt, das früheste Entdeckungsdatum bleibt.
      byId.set(t.id, {
        ...t,
        firstSeen: existing.firstSeen < t.firstSeen ? existing.firstSeen : t.firstSeen,
        isNew: t.isNew && existing.firstSeen >= t.firstSeen,
      });
    }
  }
  return [...byId.values()].sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
}

export function useTools() {
  const [tools, setTools] = useState<Tool[]>(isDemoMode ? seedTools : []);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastCuratedAt, setLastCuratedAt] = useState<string>("");
  const retries = useRef(0);

  const fetchTools = useCallback(async () => {
    const [vercel, firestore] = await Promise.all([
      fetchVercelTools(),
      fetchFirestoreTools(),
    ]);
    const merged = mergeTools([vercel.tools, firestore]);
    const result = merged.length ? merged : seedTools;
    setTools(result);
    setLastCuratedAt(merged.length ? merged[0].lastUpdated : "");
    setRefreshing(vercel.refreshing);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  useEffect(() => {
    if (!refreshing || retries.current >= MAX_RETRIES) return;
    const timer = setTimeout(() => {
      retries.current += 1;
      fetchTools();
    }, RETRY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [refreshing, tools, fetchTools]);

  return { tools, loading, refreshing, lastCuratedAt, refetch: fetchTools };
}
