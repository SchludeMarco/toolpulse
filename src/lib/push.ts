import {
  deleteToken as fcmDeleteToken,
  getMessaging,
  getToken,
  isSupported,
  onMessage,
} from "firebase/messaging";
import { app } from "./firebase";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export async function isPushSupported(): Promise<boolean> {
  if (
    !app ||
    !vapidKey ||
    !("serviceWorker" in navigator) ||
    !("Notification" in window)
  ) {
    return false;
  }
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(firebaseConfig)) {
    if (value) params.set(key, value);
  }
  return navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?${params.toString()}`
  );
}

export async function getPushToken(): Promise<string> {
  if (!app) throw new Error("Firebase ist nicht konfiguriert.");
  if (!vapidKey) {
    throw new Error(
      "VITE_FIREBASE_VAPID_KEY fehlt. Erzeuge ein Web-Push-Zertifikat unter " +
        "Projekteinstellungen → Cloud Messaging in der Firebase Console."
    );
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Benachrichtigungen wurden nicht erlaubt.");
  }
  const registration = await registerServiceWorker();
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error("Konnte keinen Push-Token erzeugen.");
  return token;
}

export async function deletePushToken(): Promise<string | null> {
  if (!app || !vapidKey) return null;
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey }).catch(() => null);
  if (token) await fcmDeleteToken(messaging);
  return token;
}

export function watchForegroundMessages(
  onNotification: (title: string, body: string) => void
): () => void {
  if (!app) return () => {};
  const messaging = getMessaging(app);
  return onMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? "ToolPulse";
    const body = payload.notification?.body ?? "";
    onNotification(title, body);
  });
}
