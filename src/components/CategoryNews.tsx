import type { NewsItem } from "../types";
import { relativeDe } from "../lib/time";

interface Props {
  items: NewsItem[];
  isDemoMode: boolean;
}

const MAX_VISIBLE = 5;

export function CategoryNews({ items, isDemoMode }: Props) {
  return (
    <section className="mb-3 border-b border-[var(--line)] pb-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Aktuelle News
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">
          {isDemoMode
            ? "News erscheinen, sobald ein Firebase-Projekt verbunden ist."
            : "Noch keine News für diesen Bereich – sie kommen mit der nächsten Kuratierung."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
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
