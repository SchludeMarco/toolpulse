// Gäste-Cookie ("Nur für Eingeladene", wie bei RetroMind): ToolPulse öffnet
// sich nur für Personen, deren E-Mail-Adresse Marco freigeschaltet hat. Nach
// der Google-Anmeldung auf /gate.html stellt /api/session ein mit
// GUEST_SECRET signiertes Cookie aus; middleware.js lässt Anfragen nur mit
// gültigem Cookie durch. Die Gästeliste selbst liegt im Vercel Blob
// (api/_guestStore.js) und wird nur von Functions gelesen; die Middleware
// prüft ausschließlich das Cookie. Dateien mit "_" sind keine Routen. Nur Web
// Crypto hier, damit die Middleware das Modul nutzen kann.

export const COOKIE = "tp_guest";
const MAX_AGE = 30 * 24 * 3600; // Cookie gilt 30 Tage
// Nach einem Tag schickt die Middleware Seitenaufrufe kurz über die
// Gästetür, die bei bestehender Google-Anmeldung die Freischaltung von selbst
// neu prüft. Ein entfernter Gast verliert den Zugang so spätestens nach einem Tag.
export const RECHECK_AFTER = 24 * 3600;

export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "marco.schlude@gmail.com").toLowerCase();

const secret = () => process.env.GUEST_SECRET || "";
const storeConfigured = () => !!(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
export const guestsConfigured = () => !!(secret() && storeConfigured());

export const normalizeEmail = (s) => String(s || "").trim().toLowerCase();
export const validEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 200;

// ---- signiertes Cookie: base64url(email).issuedAt.hmac

const enc = new TextEncoder();
const b64url = (s) =>
  btoa(String.fromCharCode(...enc.encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

async function hmac(text) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(text)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function makeCookie(email) {
  const e = normalizeEmail(email);
  const iat = Math.floor(Date.now() / 1000);
  const value = `${b64url(e)}.${iat}.${await hmac(`${e}.${iat}`)}`;
  return `${COOKIE}=${value}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax; Secure`;
}

export const clearCookie = () => `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`;

/** { email, age } aus einem gültigen, nicht abgelaufenen Cookie, sonst null. */
export async function readCookie(cookieHeader) {
  const m = new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`).exec(String(cookieHeader || ""));
  if (!m || !secret()) return null;
  const [e64, iatStr, sig] = m[1].split(".");
  if (!e64 || !iatStr || !sig) return null;
  let email;
  try {
    email = unb64url(e64);
  } catch {
    return null;
  }
  const iat = Number(iatStr);
  const age = Math.floor(Date.now() / 1000) - iat;
  if (!Number.isFinite(iat) || age < 0 || age > MAX_AGE) return null;
  if ((await hmac(`${email}.${iat}`)) !== sig) return null;
  return { email, age };
}
