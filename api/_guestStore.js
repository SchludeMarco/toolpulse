// Gästeliste im Vercel Blob (nur für Functions, nicht für die Middleware).
// Eine JSON-Datei mit den freigeschalteten Adressen; Zugriff über die
// OIDC-Anmeldung des Projekts (BLOB_STORE_ID), ohne eigenen Schlüssel.
import { get, put } from "@vercel/blob";
import { ADMIN_EMAIL, normalizeEmail } from "./_guests.js";

const PATH = "toolpulse/guests.json";
// Der Speicher kann privat oder öffentlich angelegt sein; wir nehmen privat
// und fallen sonst auf öffentlich zurück.
let access = "private";

async function withAccess(fn) {
  try {
    return await fn(access);
  } catch (e) {
    const msg = String(e?.message || e);
    if (/access|public|private/i.test(msg)) {
      access = access === "private" ? "public" : "private";
      return fn(access);
    }
    throw e;
  }
}

export async function listGuests() {
  const file = await withAccess((a) => get(PATH, { access: a, useCache: false }));
  if (!file?.stream) return [];
  try {
    const data = JSON.parse(await new Response(file.stream).text());
    return Array.isArray(data.guests) ? data.guests.map(normalizeEmail).filter(Boolean).sort() : [];
  } catch {
    return [];
  }
}

async function save(guests) {
  const list = [...new Set(guests.map(normalizeEmail).filter(Boolean))].sort();
  await withAccess((a) =>
    put(PATH, JSON.stringify({ guests: list, updatedAt: new Date().toISOString() }), {
      access: a,
      contentType: "application/json",
      allowOverwrite: true,
      addRandomSuffix: false,
      cacheControlMaxAge: 60,
    })
  );
  return list;
}

export async function addGuest(email) {
  return save([...(await listGuests()), email]);
}

export async function removeGuest(email) {
  const e = normalizeEmail(email);
  return save((await listGuests()).filter((g) => g !== e));
}

export async function isGuest(email) {
  const e = normalizeEmail(email);
  if (!e) return false;
  if (e === ADMIN_EMAIL) return true;
  return (await listGuests()).includes(e);
}
