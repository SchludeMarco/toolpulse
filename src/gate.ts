// Gästetür: Google-Anmeldung (Firebase), dann fragt /api/session, ob die
// Adresse freigeschaltet ist, und setzt das Gäste-Cookie. Danach geht es zur
// ursprünglich aufgerufenen Seite weiter.
import "./index.css";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { auth, googleProvider } from "./lib/firebase";

const status = document.getElementById("status")!;
const signinBtn = document.getElementById("signin") as HTMLButtonElement;
const switchBtn = document.getElementById("switch") as HTMLButtonElement;

const nextUrl = (() => {
  const n = new URLSearchParams(location.search).get("next") || "/";
  // Nur Pfade dieser Seite zulassen, keine fremden Adressen.
  return n.startsWith("/") && !n.startsWith("//") ? n : "/";
})();

const say = (text: string) => (status.textContent = text);

async function enter(user: User) {
  say("Prüfe Freischaltung …");
  signinBtn.disabled = true;
  try {
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { Authorization: `Bearer ${await user.getIdToken()}` },
    });
    if (res.ok) {
      location.replace(nextUrl);
      return;
    }
    if (res.status === 403) {
      say(`${user.email} ist (noch) nicht freigeschaltet. Bitte wende dich an Marco.`);
      switchBtn.hidden = false;
    } else {
      say("Die Anmeldung hat gerade nicht geklappt. Bitte später noch einmal versuchen.");
    }
  } catch {
    say("Keine Verbindung. Bitte später noch einmal versuchen.");
  }
  signinBtn.disabled = false;
}

if (!auth || !googleProvider) {
  say("Anmeldung ist hier nicht eingerichtet.");
  signinBtn.disabled = true;
} else {
  const a = auth;
  const provider = googleProvider;
  // Schon in der App angemeldet (z.B. Cookie abgelaufen): direkt weiter.
  const unsub = onAuthStateChanged(a, (user) => {
    unsub();
    if (user) void enter(user);
  });
  signinBtn.addEventListener("click", async () => {
    try {
      const { user } = await signInWithPopup(a, provider);
      await enter(user);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        say(code === "auth/popup-blocked"
          ? "Das Anmeldefenster wurde blockiert. Bitte Popups für diese Seite erlauben."
          : "Anmeldung fehlgeschlagen. Bitte erneut versuchen.");
      }
    }
  });
  switchBtn.addEventListener("click", async () => {
    await signOut(a);
    switchBtn.hidden = true;
    say("");
    signinBtn.click();
  });
}
