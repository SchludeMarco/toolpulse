import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTools } from "../hooks/useTools";
import { usePreferences } from "../hooks/usePreferences";
import { useFavorites } from "../hooks/useFavorites";
import { useCompare } from "../context/CompareContext";
import { useAuth } from "../context/AuthContext";
import { FilterBar } from "../components/FilterBar";
import { ToolCard } from "../components/ToolCard";
import { categories } from "../data/categories";
import { relativeDe } from "../lib/time";
import { triggerCurationNow } from "../lib/functions";
import type { CategoryId, PriceTier, Tool } from "../types";

export function FeedPage() {
  const { tools, loading, lastCuratedAt, refetch } = useTools();
  const { prefs, setPrefs } = usePreferences();
  const { favorites, toggleFavorite } = useFavorites();
  const { selected, toggle } = useCompare();
  const { isDemoMode } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const refreshNow = async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await triggerCurationNow();
      await refetch();
    } catch (e) {
      setRefreshError(
        e instanceof Error ? e.message : "Aktualisierung fehlgeschlagen."
      );
    } finally {
      setRefreshing(false);
    }
  };

  const [activeCategory, setActiveCategory] = useState<CategoryId | "alle">(
    "alle"
  );
  const [priceFilter, setPriceFilter] = useState<PriceTier[]>(
    prefs.priceFilter ?? []
  );
  const [expandedCategories, setExpandedCategories] = useState<
    Set<CategoryId>
  >(new Set());
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  const updatePriceFilter = (p: PriceTier[]) => {
    setPriceFilter(p);
    setPrefs({ ...prefs, priceFilter: p, updatedAt: new Date().toISOString() });
  };

  const toggleCategoryExpanded = (id: CategoryId) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleToolExpanded = (id: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toolsMatchingNonCategoryFilters = useMemo(() => {
    return tools
      .filter((t) => priceFilter.length === 0 || priceFilter.includes(t.priceTier))
      .filter((t) => t.trustScore >= prefs.minTrustScore)
      .filter((t) => (prefs.categoryWeights[t.categoryId] ?? 2) > 0);
  }, [tools, priceFilter, prefs]);

  const categoryTools = useMemo(() => {
    const grouped = {} as Record<CategoryId, Tool[]>;
    for (const t of toolsMatchingNonCategoryFilters) {
      (grouped[t.categoryId] ??= []).push(t);
    }
    for (const list of Object.values(grouped)) {
      list.sort(
        (a, b) =>
          new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
      );
    }
    return grouped;
  }, [toolsMatchingNonCategoryFilters]);

  const visibleCategories = categories.filter(
    (c) => activeCategory === "alle" || c.id === activeCategory
  );
  const totalVisibleTools = visibleCategories.reduce(
    (sum, c) => sum + (categoryTools[c.id]?.length ?? 0),
    0
  );

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
      ) : totalVisibleTools === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--text-muted)]">
          Keine Tools passen zu diesen Filtern. Passe die Preis- oder
          Bereichsauswahl an, oder aktiviere weitere Bereiche in den
          Einstellungen.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleCategories.map((c) => {
            const catTools = categoryTools[c.id] ?? [];
            const isOpen =
              expandedCategories.has(c.id) || activeCategory === c.id;
            return (
              <div key={c.id}>
                <button
                  onClick={() => toggleCategoryExpanded(c.id)}
                  aria-expanded={isOpen}
                  className="focus-ring flex items-center gap-2 rounded-md py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  <svg
                    className={`h-3.5 w-3.5 shrink-0 transition-transform ${
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
                  {c.label} ({catTools.length})
                </button>
                {isOpen && catTools.length > 0 && (
                  <div
                    className="ml-1.5 mb-2 flex flex-col gap-1 rounded-lg border-l-2 bg-[var(--surface-raised)] p-3 pl-4"
                    style={{ borderColor: c.color }}
                  >
                    {catTools.map((tool) => {
                      const toolOpen = expandedTools.has(tool.id);
                      return (
                        <div key={tool.id}>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => toggleToolExpanded(tool.id)}
                              aria-expanded={toolOpen}
                              aria-label={`Details zu ${tool.name}`}
                              className="focus-ring rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text)]"
                            >
                              <svg
                                className={`h-3 w-3 shrink-0 transition-transform ${
                                  toolOpen ? "rotate-90" : ""
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
                            </button>
                            <a
                              href={tool.url}
                              target="_blank"
                              rel="noreferrer"
                              className="focus-ring rounded-md py-1 text-sm text-[var(--text-muted)] hover:text-[var(--text)] hover:underline"
                            >
                              {tool.name}
                            </a>
                          </div>
                          {toolOpen && (
                            <div className="ml-1.5 max-w-md pl-4">
                              <ToolCard
                                tool={tool}
                                isFavorite={favorites.some(
                                  (f) => f.toolId === tool.id
                                )}
                                onToggleFavorite={toggleFavorite}
                                onSelectCompare={toggle}
                                compareSelected={selected.includes(tool.id)}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 flex flex-col items-center gap-2 border-t border-[var(--line)] pt-6">
        <button
          onClick={refreshNow}
          disabled={isDemoMode || refreshing}
          className="focus-ring rounded-md border border-[var(--line)] px-3.5 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {refreshing ? "Aktualisiere … (kann bis zu einer Minute dauern)" : "Jetzt aktualisieren"}
        </button>
        {isDemoMode && (
          <p className="text-xs text-[var(--text-muted)]">
            Manuelle Aktualisierung erfordert ein verbundenes Firebase-Projekt.
          </p>
        )}
        {refreshError && (
          <p className="text-xs text-[var(--danger)]">{refreshError}</p>
        )}
      </div>
    </div>
  );
}
