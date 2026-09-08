import { useTools } from "../hooks/useTools";
import { useCompare } from "../context/CompareContext";
import { categoryById } from "../data/categories";
import { TrustBadge } from "../components/TrustBadge";
import { formatDateDe } from "../lib/time";

const priceLabel: Record<string, string> = {
  kostenlos: "Kostenlos",
  freemium: "Freemium",
  abo: "Abo",
  einmalig: "Einmalig",
};

export function ComparePage() {
  const { tools } = useTools();
  const { selected, clear, toggle } = useCompare();
  const items = tools.filter((t) => selected.includes(t.id));

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="display text-2xl font-semibold tracking-tight">
            Vergleich
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Wähle im Feed bis zu 3 Tools zum Vergleichen aus.
          </p>
        </div>
        {items.length > 0 && (
          <button
            onClick={clear}
            className="focus-ring rounded-md border border-[var(--line)] px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            Auswahl leeren
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--text-muted)]">
          Noch keine Tools ausgewählt.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="w-36" />
                {items.map((t) => (
                  <th key={t.id} className="px-3 pb-3 text-left align-bottom">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-base font-semibold">{t.name}</div>
                        <div className="text-xs" style={{ color: categoryById(t.categoryId)?.color }}>
                          {categoryById(t.categoryId)?.label}
                        </div>
                      </div>
                      <button
                        onClick={() => toggle(t.id)}
                        aria-label="Aus Vergleich entfernen"
                        className="focus-ring rounded-md px-1 text-[var(--text-muted)] hover:text-[var(--danger)]"
                      >
                        ✕
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-sm">
              {[
                {
                  label: "Beschreibung",
                  render: (t: (typeof items)[number]) => t.description,
                },
                {
                  label: "Preis",
                  render: (t: (typeof items)[number]) =>
                    `${priceLabel[t.priceTier]}${t.priceDetail ? " · " + t.priceDetail : ""}`,
                },
                {
                  label: "Vertrauenswert",
                  render: (t: (typeof items)[number]) => <TrustBadge score={t.trustScore} />,
                },
                {
                  label: "Erstmals erfasst",
                  render: (t: (typeof items)[number]) => formatDateDe(t.firstSeen),
                },
                {
                  label: "Quellen",
                  render: (t: (typeof items)[number]) =>
                    t.sources.map((s) => s.name).join(", "),
                },
                {
                  label: "",
                  render: (t: (typeof items)[number]) => (
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noreferrer"
                      className="focus-ring inline-block rounded-md bg-[var(--surface-raised)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--line)]"
                    >
                      Öffnen
                    </a>
                  ),
                },
              ].map((row) => (
                <tr key={row.label} className="border-t border-[var(--line)]">
                  <td className="px-3 py-3 align-top text-xs text-[var(--text-muted)]">
                    {row.label}
                  </td>
                  {items.map((t) => (
                    <td key={t.id} className="px-3 py-3 align-top">
                      {row.render(t)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
