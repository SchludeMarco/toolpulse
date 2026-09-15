import { categories } from "../data/categories";
import type { CategoryId, PriceTier } from "../types";

interface Props {
  activeCategory: CategoryId | "alle";
  onCategoryChange: (c: CategoryId | "alle") => void;
  priceFilter: PriceTier[];
  onPriceFilterChange: (p: PriceTier[]) => void;
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
}: Props) {
  const togglePrice = (p: PriceTier) => {
    if (priceFilter.includes(p)) {
      onPriceFilterChange(priceFilter.filter((x) => x !== p));
    } else {
      onPriceFilterChange([...priceFilter, p]);
    }
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
    </div>
  );
}
