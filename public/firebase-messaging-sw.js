/* eslint-disable no-undef */
// Firebase-Konfiguration kommt als Query-Parameter aus src/lib/push.ts, da
// Umgebungsvariablen in statischen Dateien im public/-Ordner nicht verfügbar
// sind. Die Werte (apiKey etc.) sind bei Firebase-Web-Apps nicht geheim.
importScripts(
  "https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js"
);

const params = new URLSearchParams(self.location.search);
const firebaseConfig = {
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  storageBucket: params.get("storageBucket"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
};

if (firebaseConfig.apiKey) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const { title, body } = payload.notification ?? {};
    self.registration.showNotification(title ?? "ToolPulse", {
      body: body ?? "",
      icon: "/favicon.svg",
      data: payload.data ?? {},
    });
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url;
  event.waitUntil(clients.openWindow(url || "/"));
});
