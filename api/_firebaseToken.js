// Prüft ein Firebase-ID-Token (Google-Anmeldung in der App) gegen Googles
// öffentliche Schlüssel und liefert die bestätigte E-Mail-Adresse, sonst null.
import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

export async function firebaseEmail(idToken) {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  if (!idToken || !projectId) return null;
  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    if (!payload.email || payload.email_verified !== true) return null;
    return String(payload.email).trim().toLowerCase();
  } catch {
    return null;
  }
}

export const bearer = (request) =>
  (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
