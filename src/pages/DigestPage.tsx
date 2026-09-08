import { useTools } from "../hooks/useTools";
import { categories, categoryById } from "../data/categories";
import { formatDateDe } from "../lib/time";

export function DigestPage() {
  const { tools } = useTools();

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = tools.filter(
    (t) => new Date(t.lastUpdated).getTime() >= sevenDaysAgo
  );

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <h1 className="display text-2xl font-semibold tracking-tight">
        Wochen-Digest
      </h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Für alle, die nicht täglich reinschauen: eine Zusammenfassung der
        letzten 7 Tage, {formatDateDe(new Date(sevenDaysAgo).toISOString())} –{" "}
        {formatDateDe(new Date().toISOString())}.
      </p>

      {recent.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--text-muted)]">
          Diese Woche gab es noch keine erfassten Änderungen.
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-8">
          {categories.map((cat) => {
            const inCat = recent.filter((t) => t.categoryId === cat.id);
            if (inCat.length === 0) return null;
            return (
              <section key={cat.id}>
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: cat.color }}
                  />
                  <h2 className="text-base font-semibold">{cat.label}</h2>
                  <span className="text-xs text-[var(--text-muted)]">
                    {inCat.length} Update{inCat.length === 1 ? "" : "s"}
                  </span>
                </div>
                <ul className="flex flex-col divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
                  {inCat.map((t) => (
                    <li key={t.id} className="flex items-start justify-between gap-4 px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <a
                            href={t.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium hover:text-[var(--amber)]"
                          >
                            {t.name}
                          </a>
                          {t.isNew && (
                            <span className="rounded-full bg-[var(--teal)]/15 px-2 py-0.5 text-[11px] font-medium text-[var(--teal)]">
                              Neu
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                          {t.tagline}
                        </p>
                      </div>
                      <span className="whitespace-nowrap pt-0.5 text-xs text-[var(--text-muted)]">
                        {formatDateDe(t.lastUpdated)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      <p className="mt-8 text-xs text-[var(--text-muted)]">
        Bereich fehlt in der Übersicht: {" "}
        {categories.filter((c) => !recent.some((t) => t.categoryId === c.id)).map((c) => categoryById(c.id)?.label).join(", ") || "keiner — überall Bewegung diese Woche."}
      </p>
    </div>
  );
}
