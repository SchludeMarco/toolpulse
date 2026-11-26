import { useState } from "react";
import type { NewsItem } from "../types";
import { relativeDe } from "../lib/time";

interface Props {
  items: NewsItem[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
}

const MAX_VISIBLE = 5;

export function CategoryNews({ items, loading, refreshing, error }: Props) {
  // Standardmäßig eingeklappt, damit die Tools im Vordergrund stehen.
  const [open, setOpen] = useState(false);

  return (
    <section className="mb-3 border-b border-[var(--line)] pb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="focus-ring flex items-center gap-1.5 rounded-md text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        <svg
          className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
        Aktuelle News{items.length > 0 ? ` (${items.length})` : ""}
      </button>
      {!open ? null : items.length === 0 ? (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          {loading
            ? "Lade aktuelle News …"
            : refreshing
              ? "News werden gerade gesammelt – das dauert etwa eine Minute …"
            : error
              ? "News sind gerade nicht verfügbar. Versuch es später noch einmal."
              : "Keine aktuellen News für diesen Bereich gefunden."}
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2.5">
          {items.slice(0, MAX_VISIBLE).map((n) => (
            <li key={n.id}>
              <a
                href={n.url}
                target="_blank"
                rel="noreferrer"
                className="focus-ring block rounded-md text-sm font-medium leading-snug text-[var(--text)] hover:underline"
              >
                {n.title}
              </a>
              {n.summary && (
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-muted)]">
                  {n.summary}
                </p>
              )}
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)] opacity-70">
                {n.source ? `${n.source} · ` : ""}
                {relativeDe(n.publishedAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
