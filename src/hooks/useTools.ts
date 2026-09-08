import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (isDemoMode || !db) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const q = query(collection(db!, "tools"), orderBy("lastUpdated", "desc"));
      const snap = await getDocs(q);
      if (cancelled) return;
      const fetched = snap.docs.map((d) => d.data() as Tool);
      setTools(fetched.length ? fetched : seedTools);
      if (fetched.length) setLastCuratedAt(fetched[0].lastUpdated);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { tools, loading, lastCuratedAt };
}
