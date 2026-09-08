import { usePreferences } from "../hooks/usePreferences";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { categories } from "../data/categories";
import { useAuth } from "../context/AuthContext";

const weightLabels = ["Ausgeblendet", "Weniger", "Normal", "Bevorzugt"];

export function SettingsPage() {
  const { prefs, setPrefs, loading } = usePreferences();
  const { user, isDemoMode } = useAuth();
  const push = usePushNotifications();

  const updateWeight = (id: string, value: number) => {
    setPrefs({
      ...prefs,
      categoryWeights: { ...prefs.categoryWeights, [id]: value },
      updatedAt: new Date().toISOString(),
    });
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-8 text-sm text-[var(--text-muted)]">
        Lade Einstellungen …
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="display text-2xl font-semibold tracking-tight">
        Einstellungen
      </h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        {user
          ? `Gespeichert für ${"displayName" in user ? user.displayName : "dein Konto"}${isDemoMode ? " (lokal, Demo-Modus)" : ""}.`
          : "Melde dich an, um Einstellungen geräteübergreifend zu speichern."}
      </p>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-[var(--text-muted)]">
          Gewichtung pro Bereich
        </h2>
        <div className="mt-3 flex flex-col gap-4">
          {categories.map((c) => (
            <div key={c.id} className="rounded-lg border border-[var(--line)] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: c.color }}
                  />
                  <span className="text-sm font-medium">{c.label}</span>
                </div>
                <span className="text-xs text-[var(--text-muted)]">
                  {weightLabels[prefs.categoryWeights[c.id] ?? 2]}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={3}
                step={1}
                value={prefs.categoryWeights[c.id] ?? 2}
                onChange={(e) => updateWeight(c.id, Number(e.target.value))}
                className="focus-ring mt-3 w-full accent-[var(--amber)]"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-[var(--text-muted)]">
          Mindest-Vertrauenswert
        </h2>
        <div className="mt-3 rounded-lg border border-[var(--line)] p-4">
          <div className="flex items-center justify-between text-sm">
            <span>Nur Tools ab</span>
            <span className="text-[var(--amber)]">{prefs.minTrustScore}/100</span>
          </div>
          <input
            type="range"
            min={0}
            max={90}
            step={5}
            value={prefs.minTrustScore}
            onChange={(e) =>
              setPrefs({
                ...prefs,
                minTrustScore: Number(e.target.value),
                updatedAt: new Date().toISOString(),
              })
            }
            className="focus-ring mt-3 w-full accent-[var(--amber)]"
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-[var(--text-muted)]">
          Digest-Frequenz
        </h2>
        <div className="mt-3 flex gap-2">
          {(["täglich", "wöchentlich"] as const).map((f) => (
            <button
              key={f}
              onClick={() =>
                setPrefs({
                  ...prefs,
                  digestFrequency: f,
                  updatedAt: new Date().toISOString(),
                })
              }
              className={`focus-ring rounded-md border px-3.5 py-2 text-sm ${
                prefs.digestFrequency === f
                  ? "border-[var(--amber)] text-[var(--amber)]"
                  : "border-[var(--line)] text-[var(--text-muted)]"
              }`}
            >
              {f === "täglich" ? "Täglich" : "Wöchentlich"}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Steuert nur die Vorauswahl der Digest-Ansicht.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-[var(--text-muted)]">
          Push-Benachrichtigungen
        </h2>
        <div className="mt-3 rounded-lg border border-[var(--line)] p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Tool des Tages</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                Erhalte eine Benachrichtigung, sobald die tägliche Kuratierung
                ein neues Top-Tool findet.
              </p>
            </div>
            <button
              disabled={!user || isDemoMode || !push.supported || push.busy}
              onClick={() => (push.enabled ? push.disable() : push.enable())}
              className={`focus-ring shrink-0 rounded-md border px-3.5 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                push.enabled
                  ? "border-[var(--amber)] text-[var(--amber)]"
                  : "border-[var(--line)] text-[var(--text-muted)]"
              }`}
            >
              {push.busy
                ? "Bitte warten …"
                : push.enabled
                  ? "Deaktivieren"
                  : "Aktivieren"}
            </button>
          </div>
          {!user && (
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              Melde dich an, um Push-Benachrichtigungen zu aktivieren.
            </p>
          )}
          {user && isDemoMode && (
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              Push-Benachrichtigungen erfordern ein verbundenes
              Firebase-Projekt (nicht im Demo-Modus verfügbar, siehe README).
            </p>
          )}
          {user && !isDemoMode && !push.supported && (
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              Dein Browser unterstützt keine Push-Benachrichtigungen, oder es
              fehlt der VAPID-Schlüssel (`VITE_FIREBASE_VAPID_KEY`, siehe
              README).
            </p>
          )}
          {push.error && (
            <p className="mt-3 text-xs text-[var(--danger)]">{push.error}</p>
          )}
        </div>
      </section>
    </div>
  );
}
