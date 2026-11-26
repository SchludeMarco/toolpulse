// Gästeliste ("Nur für Eingeladene", wie bei RetroMind): ToolPulse öffnet
// sich nur für Personen, deren E-Mail-Adresse Marco freigeschaltet hat. Die
// Liste liegt in der Upstash-Datenbank (Set tp:guests), Marco (ADMIN_EMAIL)
// ist immer freigeschaltet. Nach der Google-Anmeldung auf /gate.html stellt
// der Server ein signiertes Cookie aus; middleware.js lässt Anfragen nur mit
// gültigem Cookie durch. Dateien mit "_" sind keine Routen. Nur Web Crypto und
// fetch, damit die Middleware das Modul auch nutzen kann.

export const COOKIE = "tp_guest";
const MAX_AGE = 30 * 24 * 3600; // 30 Tage angemeldet nach der letzten Prüfung
export const RECHECK_AFTER = 24 * 3600; // Liste höchstens einmal am Tag neu prüfen
const GUESTS_KEY = "tp:guests";

export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "marco.schlude@gmail.com").toLowerCase();

const redisUrl = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const secret = () => process.env.GUEST_SECRET || redisToken() || "";
export const guestsConfigured = () => !!(redisUrl() && redisToken() && secret());

async function redis(command) {
  const res = await fetch(redisUrl(), {
    method: "POST",
    headers: { Authorization: `Bearer ${redisToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  const out = await res.json();
  if (out.error) throw new Error(`redis: ${out.error}`);
  return out.result;
}

export const normalizeEmail = (s) => String(s || "").trim().toLowerCase();
export const validEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 200;

export async function isGuest(email) {
  const e = normalizeEmail(email);
  if (!e) return false;
  if (e === ADMIN_EMAIL) return true;
  return (await redis(["SISMEMBER", GUESTS_KEY, e])) === 1;
}
export const listGuests = async () => ((await redis(["SMEMBERS", GUESTS_KEY])) || []).sort();
export const addGuest = (email) => redis(["SADD", GUESTS_KEY, normalizeEmail(email)]);
export const removeGuest = (email) => redis(["SREM", GUESTS_KEY, normalizeEmail(email)]);

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
