// "Nur für Eingeladene" (wie bei RetroMind): ToolPulse ist ein privates
// Angebot für die Personen, die Marco freischaltet, keine öffentliche Website.
// Jede Anfrage braucht das signierte Gäste-Cookie von /gate.html
// (api/_guests.js); ohne leiten Seiten zur Gästetür um und API-Aufrufe
// bekommen 401. Die Gästeliste wird höchstens einmal am Tag neu geprüft, ein
// Entfernen greift also innerhalb eines Tages. Vorschau-Deployments bleiben
// offen (die schützt Vercel selbst). Ohne verbundene Datenbank bleibt die App
// offen, statt alle auszusperren.
import { next } from "@vercel/functions";
import { RECHECK_AFTER, clearCookie, guestsConfigured, isGuest, makeCookie, readCookie } from "./api/_guests.js";

const OPEN = [
  /^\/gate\.html$/,
  /^\/api\/session$/,
  /^\/favicon\.svg$/,
  /^\/robots\.txt$/,
  /^\/firebase-messaging-sw\.js$/,
];

export const config = {
  // Gebaute JS-/CSS-Dateien enthalten keine Daten und bleiben außen vor; die
  // Seiten, die sie laden, werden geprüft.
  matcher: ["/((?!assets/).*)"],
};

const isPage = (request) =>
  request.headers.get("sec-fetch-mode") === "navigate" || (request.headers.get("accept") || "").includes("text/html");

function deny(request, url) {
  if (url.pathname.startsWith("/api/") || !isPage(request)) {
    return new Response(JSON.stringify({ error: "guests_only" }), {
      status: 401,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
  const gate = new URL("/gate.html", url);
  gate.searchParams.set("next", url.pathname + url.search);
  return new Response(null, {
    status: 302,
    headers: { Location: gate.toString(), "Cache-Control": "no-store", "Set-Cookie": clearCookie() },
  });
}

export default async function middleware(request) {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return next();
  if (!guestsConfigured()) return next();
  const url = new URL(request.url);
  if (OPEN.some((re) => re.test(url.pathname))) return next();

  const guest = await readCookie(request.headers.get("cookie"));
  if (!guest) return deny(request, url);
  if (guest.age > RECHECK_AFTER && isPage(request)) {
    let still = true;
    try {
      still = await isGuest(guest.email);
    } catch {
      return next(); // Datenbank kurz weg: durchlassen, die nächste Seite prüft erneut
    }
    if (!still) return deny(request, url);
    return next({ headers: { "Set-Cookie": await makeCookie(guest.email) } });
  }
  return next();
}
