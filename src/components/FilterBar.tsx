import { useState } from "react";
import { categories } from "../data/categories";
import type { CategoryId, PriceTier, Tool } from "../types";

interface Props {
  activeCategory: CategoryId | "alle";
  onCategoryChange: (c: CategoryId | "alle") => void;
  priceFilter: PriceTier[];
  onPriceFilterChange: (p: PriceTier[]) => void;
  categoryTools?: Partial<Record<CategoryId, Tool[]>>;
}

const priceOptions: PriceTier[] = ["kostenlos", "freemium", "abo", "einmalig"];
const priceLabel: Record<PriceTier, string> = {
  kostenlos: "Kostenlos",
  freemium: "Freemium",
  abo: "Abo",
  einmalig: "Einmalig",
};

export function FilterBar({
  activeCategory,
  onCategoryChange,
  priceFilter,
  onPriceFilterChange,
  categoryTools,
}: Props) {
  const [expandedCounts, setExpandedCounts] = useState<Set<CategoryId>>(
    new Set()
  );

  const togglePrice = (p: PriceTier) => {
    if (priceFilter.includes(p)) {
      onPriceFilterChange(priceFilter.filter((x) => x !== p));
    } else {
      onPriceFilterChange([...priceFilter, p]);
    }
  };

  const toggleCountExpanded = (id: CategoryId) => {
    setExpandedCounts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onCategoryChange("alle")}
          className={`focus-ring rounded-full border px-3 py-1.5 text-sm transition-colors ${
            activeCategory === "alle"
              ? "border-[var(--amber)] text-[var(--amber)]"
              : "border-[var(--line)] text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          Alle Bereiche
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => onCategoryChange(c.id)}
            className="focus-ring flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors"
            style={{
              borderColor: activeCategory === c.id ? c.color : "var(--line)",
              color: activeCategory === c.id ? c.color : "var(--text-muted)",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: c.color }}
            />
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-[var(--text-muted)]">Preis:</span>
        {priceOptions.map((p) => (
          <button
            key={p}
            onClick={() => togglePrice(p)}
            className={`focus-ring rounded-md border px-2.5 py-1 text-xs transition-colors ${
              priceFilter.includes(p)
                ? "border-[var(--teal)] text-[var(--teal)]"
                : "border-[var(--line)] text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {priceLabel[p]}
          </button>
        ))}
      </div>

      {activeCategory === "alle" && categoryTools && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-[var(--text-muted)]">
            Beiträge je Bereich:
          </span>
          <ul className="flex flex-col gap-1">
            {categories.map((c) => {
              const tools = categoryTools[c.id] ?? [];
              const isOpen = expandedCounts.has(c.id);
              return (
                <li key={c.id}>
                  <button
                    onClick={() => toggleCountExpanded(c.id)}
                    aria-expanded={isOpen}
                    className="focus-ring flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
                  >
                    <svg
                      className={`h-3 w-3 shrink-0 transition-transform ${
                        isOpen ? "rotate-90" : ""
                      }`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: c.color }}
                    />
                    {c.label} ({tools.length})
                  </button>
                  {isOpen && tools.length > 0 && (
                    <ul className="ml-1.5 mt-1 flex flex-col gap-1 border-l border-[var(--line)] pl-4 text-xs text-[var(--text-muted)]">
                      {tools.map((t) => (
                        <li key={t.id}>
                          <a
                            href={t.url}
                            target="_blank"
                            rel="noreferrer"
                            className="focus-ring hover:text-[var(--text)] hover:underline"
                          >
                            {t.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
