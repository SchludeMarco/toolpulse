import { useCallback, useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db, isDemoMode } from "../lib/firebase";
import { seedTools } from "../data/seedTools";
import type { Tool } from "../types";

export function useTools() {
  const [tools, setTools] = useState<Tool[]>(isDemoMode ? seedTools : []);
  const [loading, setLoading] = useState(!isDemoMode);
  const [lastCuratedAt, setLastCuratedAt] = useState<string>(
    isDemoMode ? new Date().toISOString() : ""
  );

  const fetchTools = useCallback(async () => {
    if (isDemoMode || !db) return;
    setLoading(true);
    try {
      const q = query(collection(db, "tools"), orderBy("lastUpdated", "desc"));
      const snap = await getDocs(q);
      const fetched = snap.docs.map((d) => d.data() as Tool);
      setTools(fetched.length ? fetched : seedTools);
      if (fetched.length) setLastCuratedAt(fetched[0].lastUpdated);
    } catch (e) {
      console.error("Tools konnten nicht aus Firestore geladen werden:", e);
      setTools(seedTools);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  return { tools, loading, lastCuratedAt, refetch: fetchTools };
}
