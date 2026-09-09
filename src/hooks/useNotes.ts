import { useEffect, useState, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, isDemoMode } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import type { Note } from "../types";

const localKey = (uid: string) => `toolpulse:notes:${uid}`;

export function useNotes() {
  const { user } = useAuth();
  const uid = user?.uid ?? "anon";
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const useFirestore = !isDemoMode && !!db && !!user;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (!useFirestore) {
        const raw = localStorage.getItem(localKey(uid));
        if (!cancelled) {
          setNotes(raw ? JSON.parse(raw) : []);
          setLoading(false);
        }
        return;
      }
      try {
        const snap = await getDoc(doc(db!, "notes", uid));
        if (cancelled) return;
        setNotes(snap.exists() ? (snap.data().items as Note[]) : []);
      } catch (e) {
        console.error("Notizen konnten nicht geladen werden:", e);
        if (!cancelled) setNotes([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, useFirestore]);

  const persist = useCallback(
    async (next: Note[]) => {
      setNotes(next);
      if (!useFirestore) {
        localStorage.setItem(localKey(uid), JSON.stringify(next));
        return;
      }
      await setDoc(doc(db!, "notes", uid), { items: next });
    },
    [uid, useFirestore]
  );

  const addNote = useCallback(
    (title: string, content: string) => {
      const now = new Date().toISOString();
      const note: Note = {
        id: crypto.randomUUID(),
        title: title.trim() || "Ohne Titel",
        content: content.trim(),
        createdAt: now,
        updatedAt: now,
      };
      persist([note, ...notes]);
    },
    [notes, persist]
  );

  const updateNote = useCallback(
    (id: string, fields: Partial<Pick<Note, "title" | "content">>) => {
      persist(
        notes.map((n) =>
          n.id === id
            ? { ...n, ...fields, updatedAt: new Date().toISOString() }
            : n
        )
      );
    },
    [notes, persist]
  );

  const deleteNote = useCallback(
    (id: string) => {
      persist(notes.filter((n) => n.id !== id));
    },
    [notes, persist]
  );

  return { notes, addNote, updateNote, deleteNote, loading };
}
