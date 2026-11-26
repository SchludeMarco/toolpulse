// /api/guests — Gästeliste pflegen, nur für Marco (ADMIN_EMAIL).
// Authorization: Bearer <Firebase-ID-Token>
// GET: Liste · POST {email}: freischalten · DELETE {email}: entfernen
import { ADMIN_EMAIL, guestsConfigured, normalizeEmail, validEmail } from "./_guests.js";
import { addGuest, listGuests, removeGuest } from "./_guestStore.js";
import { bearer, firebaseEmail } from "./_firebaseToken.js";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

async function admin(request) {
  const email = await firebaseEmail(bearer(request));
  return email && email === ADMIN_EMAIL ? email : null;
}

export async function GET(request) {
  if (!(await admin(request))) return json({ error: "forbidden" }, 403);
  if (!guestsConfigured()) return json({ configured: false, admin: ADMIN_EMAIL, guests: [] });
  return json({ configured: true, admin: ADMIN_EMAIL, guests: await listGuests() });
}

async function change(request, fn) {
  if (!(await admin(request))) return json({ error: "forbidden" }, 403);
  if (!guestsConfigured()) return json({ error: "not_configured" }, 503);
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!validEmail(email)) return json({ error: "invalid_email" }, 400);
  return json({ ok: true, guests: await fn(email) });
}

export const POST = (request) => change(request, addGuest);
export const DELETE = (request) => change(request, removeGuest);
