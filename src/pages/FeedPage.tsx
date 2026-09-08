import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTools } from "../hooks/useTools";
import { usePreferences } from "../hooks/usePreferences";
import { useFavorites } from "../hooks/useFavorites";
import { useCompare } from "../context/CompareContext";
import { FilterBar } from "../components/FilterBar";
import { ToolCard } from "../components/ToolCard";
import { relativeDe } from "../lib/time";
import type { CategoryId, PriceTier } from "../types";

export function FeedPage() {
  const { tools, loading, lastCuratedAt } = useTools();
  const { prefs, setPrefs } = usePreferences();
  const { favorites, toggleFavorite } = useFavorites();
  const { selected, toggle } = useCompare();

  const [activeCategory, setActiveCategory] = useState<CategoryId | "alle">(
    "alle"
  );
  const [priceFilter, setPriceFilter] = useState<PriceTier[]>(
    prefs.priceFilter ?? []
  );

  const updatePriceFilter = (p: PriceTier[]) => {
    setPriceFilter(p);
    setPrefs({ ...prefs, priceFilter: p, updatedAt: new Date().toISOString() });
  };

  const visibleTools = useMemo(() => {
    return tools
      .filter((t) => activeCategory === "alle" || t.categoryId === activeCategory)
      .filter((t) => priceFilter.length === 0 || priceFilter.includes(t.priceTier))
      .filter((t) => t.trustScore >= prefs.minTrustScore)
      .filter((t) => (prefs.categoryWeights[t.categoryId] ?? 2) > 0)
      .sort((a, b) => {
        const wa = prefs.categoryWeights[a.categoryId] ?? 2;
        const wb = prefs.categoryWeights[b.categoryId] ?? 2;
        if (wa !== wb) return wb - wa;
        return (
          new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
        );
      });
  }, [tools, activeCategory, priceFilter, prefs]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-2xl font-semibold tracking-tight">
            Heutiger Feed
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {lastCuratedAt
              ? `Letzte Kuratierung ${relativeDe(lastCuratedAt)}`
              : "Wird geladen …"}{" "}
            · sortiert nach deinen Gewichtungen
          </p>
        </div>
        {selected.length > 0 && (
          <Link
            to="/vergleich"
            className="focus-ring rounded-md bg-[var(--surface-raised)] px-3.5 py-2 text-sm font-medium hover:bg-[var(--line)]"
          >
            {selected.length} zum Vergleich ausgewählt →
          </Link>
        )}
      </div>

      <div className="mb-6">
        <FilterBar
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          priceFilter={priceFilter}
          onPriceFilterChange={updatePriceFilter}
        />
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Lade Tools …</p>
      ) : visibleTools.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--text-muted)]">
          Keine Tools passen zu diesen Filtern. Passe die Preis- oder
          Bereichsauswahl an, oder aktiviere weitere Bereiche in den
          Einstellungen.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleTools.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              isFavorite={favorites.some((f) => f.toolId === tool.id)}
              onToggleFavorite={toggleFavorite}
              onSelectCompare={toggle}
              compareSelected={selected.includes(tool.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
