import { useCallback, useEffect, useState } from "react";
import { arrayRemove, arrayUnion, doc, getDoc, setDoc } from "firebase/firestore";
import { db, isDemoMode } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import {
  deletePushToken,
  getPushToken,
  isPushSupported,
  watchForegroundMessages,
} from "../lib/push";

export function usePushNotifications() {
  const { user } = useAuth();
  const uid = user?.uid;
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isPushSupported().then(setSupported);
  }, []);

  useEffect(() => {
    if (!uid || isDemoMode || !db) return;
    let cancelled = false;
    getDoc(doc(db, "pushSubscriptions", uid)).then((snap) => {
      if (cancelled) return;
      const tokens: string[] = snap.exists() ? snap.data().tokens ?? [] : [];
      setEnabled(tokens.length > 0 && Notification.permission === "granted");
    });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    if (!enabled) return;
    return watchForegroundMessages((title, body) => {
      if (Notification.permission === "granted") {
        new Notification(title, { body, icon: "/favicon.svg" });
      }
    });
  }, [enabled]);

  const enable = useCallback(async () => {
    if (!uid || isDemoMode || !db) {
      setError(
        "Push-Benachrichtigungen erfordern ein verbundenes Firebase-Projekt (kein Demo-Modus)."
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await getPushToken();
      await setDoc(
        doc(db, "pushSubscriptions", uid),
        { tokens: arrayUnion(token), updatedAt: new Date().toISOString() },
        { merge: true }
      );
      setEnabled(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aktivierung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }, [uid]);

  const disable = useCallback(async () => {
    if (!uid || isDemoMode || !db) return;
    setBusy(true);
    setError(null);
    try {
      const token = await deletePushToken();
      if (token) {
        await setDoc(
          doc(db, "pushSubscriptions", uid),
          { tokens: arrayRemove(token), updatedAt: new Date().toISOString() },
          { merge: true }
        );
      }
      setEnabled(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deaktivierung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }, [uid]);

  return { supported, enabled, busy, error, enable, disable };
}
