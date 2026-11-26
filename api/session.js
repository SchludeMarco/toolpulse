// /api/session — Eintritt durch die Gästetür.
// POST (Authorization: Bearer <Firebase-ID-Token>): Ist die Adresse
//   freigeschaltet, gibt es das Gäste-Cookie, sonst 403.
// DELETE: Cookie löschen (Abmelden).
// GET: Diagnose, ob Gästezugang eingerichtet und die Liste lesbar ist
//   (ohne Adressen preiszugeben).
import { clearCookie, guestsConfigured, makeCookie } from "./_guests.js";
import { isGuest, listGuests } from "./_guestStore.js";
import { bearer, firebaseEmail } from "./_firebaseToken.js";

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });

export async function POST(request) {
  const email = await firebaseEmail(bearer(request));
  if (!email) return json({ error: "invalid_token" }, 401);
  if (!guestsConfigured()) return json({ ok: true, email, gate: false });
  let invited;
  try {
    invited = await isGuest(email);
  } catch (e) {
    console.error("Gästeliste nicht erreichbar:", e);
    return json({ error: "unavailable" }, 503);
  }
  if (!invited) return json({ error: "not_invited", email }, 403);
  return json({ ok: true, email }, 200, { "Set-Cookie": await makeCookie(email) });
}

export async function DELETE() {
  return json({ ok: true }, 200, { "Set-Cookie": clearCookie() });
}

export async function GET() {
  if (!guestsConfigured()) return json({ configured: false });
  try {
    const guests = await listGuests();
    return json({ configured: true, store: "ok", count: guests.length });
  } catch (e) {
    console.error("Gästeliste nicht lesbar:", e);
    return json({ configured: true, store: "error" }, 503);
  }
}
