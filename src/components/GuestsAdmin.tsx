import { useCallback, useEffect, useState } from "react";
import { auth } from "../lib/firebase";

// Gästeliste pflegen: nur für Marco sichtbar (der Server prüft das selbst,
// /api/guests antwortet allen anderen mit 403, dann bleibt der Bereich weg).
interface GuestsState {
  configured: boolean;
  admin: string;
  guests: string[];
}

async function call(method: string, body?: unknown): Promise<Response | null> {
  const user = auth?.currentUser;
  if (!user) return null;
  return fetch("/api/guests", {
    method,
    headers: {
      Authorization: `Bearer ${await user.getIdToken()}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function GuestsAdmin() {
  const [state, setState] = useState<GuestsState | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await call("GET").catch(() => null);
    if (!res?.ok) return setState(null);
    setState(await res.json());
  }, []);

  useEffect(() => {
    if (!auth) return;
    return auth.onAuthStateChanged(() => void load());
  }, [load]);

  if (!state) return null;

  const change = async (method: "POST" | "DELETE", address: string) => {
    setBusy(true);
    setMessage(null);
    const res = await call(method, { email: address }).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setState((s) => (s ? { ...s, guests: data.guests } : s));
      if (method === "POST") setEmail("");
    } else {
      const err = res ? (await res.json().catch(() => ({}))).error : null;
      setMessage(
        err === "invalid_email"
          ? "Das ist keine gültige E-Mail-Adresse."
          : "Hat nicht geklappt. Bitte noch einmal versuchen."
      );
    }
    setBusy(false);
  };

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-[var(--text-muted)]">Gäste</h2>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        Nur freigeschaltete Google-Konten können ToolPulse öffnen. Du ({state.admin})
        bist immer freigeschaltet. Entfernte Gäste verlieren den Zugang spätestens
        nach einem Tag.
      </p>

      {!state.configured ? (
        <p className="mt-3 rounded-md border border-[var(--line)] px-3 py-2 text-xs text-[var(--text-muted)]">
          Die Gästeliste ist noch nicht aktiv: Verbinde in Vercel die
          Upstash-Datenbank mit dem Projekt „toolpulse“. Bis dahin ist die App
          für alle offen.
        </p>
      ) : (
        <>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) void change("POST", email.trim());
            }}
          >
            <input
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="name@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="focus-ring min-w-0 flex-1 rounded-md border border-[var(--line)] bg-transparent px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="focus-ring rounded-md bg-[var(--surface-raised)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--line)] disabled:opacity-50"
            >
              Freischalten
            </button>
          </form>
          {message && <p className="mt-2 text-xs text-[var(--danger)]">{message}</p>}
          <ul className="mt-3 flex flex-col divide-y divide-[var(--line)] rounded-lg border border-[var(--line)]">
            {state.guests.length === 0 && (
              <li className="px-3 py-2 text-xs text-[var(--text-muted)]">
                Noch keine Gäste freigeschaltet.
              </li>
            )}
            {state.guests.map((g) => (
              <li key={g} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="truncate">{g}</span>
                <button
                  onClick={() => void change("DELETE", g)}
                  disabled={busy}
                  className="focus-ring shrink-0 rounded-md px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--danger)] disabled:opacity-50"
                >
                  Entfernen
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
