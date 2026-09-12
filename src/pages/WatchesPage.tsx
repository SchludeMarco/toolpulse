import { useState } from "react";
import { useWatches } from "../hooks/useWatches";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { useAuth } from "../context/AuthContext";
import { categories, categoryById } from "../data/categories";
import { formatDateDe, relativeDe } from "../lib/time";
import type { CategoryId, Watch } from "../types";

function WatchCard({
  watch,
  onToggle,
  onDelete,
}: {
  watch: Watch;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const category = categoryById(watch.categoryId);

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: category?.color }}
          />
          <span className="text-sm font-medium">{category?.label ?? watch.categoryId}</span>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${
            watch.active
              ? "border-[var(--amber)] text-[var(--amber)]"
              : "border-[var(--line)] text-[var(--text-muted)]"
          }`}
        >
          {watch.active ? "Aktiv" : "Pausiert"}
        </span>
      </div>

      <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-muted)]">
        {watch.query}
      </p>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
        <span>Angelegt: {formatDateDe(watch.createdAt)}</span>
        <span>
          Zuletzt geprüft:{" "}
          {watch.lastCheckedAt ? relativeDe(watch.lastCheckedAt) : "noch nicht"}
        </span>
        <span>
          Zuletzt ausgelöst:{" "}
          {watch.lastTriggeredAt ? relativeDe(watch.lastTriggeredAt) : "noch nie"}
        </span>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onToggle(watch.id)}
          className="focus-ring rounded-md border border-[var(--line)] px-3 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          {watch.active ? "Pausieren" : "Aktivieren"}
        </button>
        <button
          onClick={() => onDelete(watch.id)}
          className="focus-ring rounded-md border border-[var(--line)] px-3 py-1 text-xs text-[var(--danger)] hover:opacity-80"
        >
          Löschen
        </button>
      </div>
    </div>
  );
}

export function WatchesPage() {
  const { watches, addWatch, toggleActive, deleteWatch, loading, saveError } =
    useWatches();
  const { user, isDemoMode } = useAuth();
  const push = usePushNotifications();
  const [categoryId, setCategoryId] = useState<CategoryId>(categories[0].id);
  const [query, setQuery] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    addWatch(categoryId, query);
    setQuery("");
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="display text-2xl font-semibold tracking-tight">
        Beobachtungen
      </h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Beschreibe eine Bedingung für einen Bereich — sobald sie zutrifft,
        bekommst du sofort eine Push-Benachrichtigung. Mehrere Beobachtungen
        gleichzeitig sind möglich. Beispiel: „Ein neues Tool wird im IT-Sektor
        plötzlich sehr viel genutzt.“
      </p>

      {user && !isDemoMode && !push.enabled && (
        <p className="mt-3 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-muted)]">
          Aktiviere Push-Benachrichtigungen unter Einstellungen, um Alerts zu
          deinen Beobachtungen zu erhalten.
        </p>
      )}
      {isDemoMode && (
        <p className="mt-3 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-muted)]">
          Im Demo-Modus lassen sich Beobachtungen anlegen und einsehen, echte
          Push-Alerts erfordern jedoch ein verbundenes Firebase-Projekt.
        </p>
      )}

      {saveError && (
        <p className="mt-3 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">
          Änderungen konnten nicht gespeichert werden: {saveError}
        </p>
      )}

      <form
        onSubmit={submit}
        className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"
      >
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value as CategoryId)}
          className="focus-ring w-full rounded-md border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 text-sm font-medium"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={3}
          placeholder="Wonach möchtest du sofort benachrichtigt werden?"
          className="focus-ring mt-2 w-full resize-y rounded-md border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="focus-ring mt-3 rounded-md bg-[var(--amber)] px-3.5 py-1.5 text-sm font-medium text-[#0E1116] hover:opacity-90"
        >
          Beobachtung anlegen
        </button>
      </form>

      {loading ? (
        <p className="mt-8 text-sm text-[var(--text-muted)]">
          Lade Beobachtungen …
        </p>
      ) : watches.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--text-muted)]">
          Noch keine Beobachtungen — leg oben deine erste an.
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-3">
          {watches.map((watch) => (
            <WatchCard
              key={watch.id}
              watch={watch}
              onToggle={toggleActive}
              onDelete={deleteWatch}
            />
          ))}
        </div>
      )}
    </div>
  );
}
