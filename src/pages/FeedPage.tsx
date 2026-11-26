import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTools } from "../hooks/useTools";
import { useNews } from "../hooks/useNews";
import { usePreferences } from "../hooks/usePreferences";
import { useFavorites } from "../hooks/useFavorites";
import { useCompare } from "../context/CompareContext";
import { FilterBar } from "../components/FilterBar";
import { ToolCard } from "../components/ToolCard";
import { CategoryNews } from "../components/CategoryNews";
import { categories } from "../data/categories";
import { matchesAgeFilter, relativeDe } from "../lib/time";
import type {
  AgeFilter,
  CategoryId,
  NewsItem,
  PriceTier,
  Tool,
} from "../types";

// So viele neueste Tools zeigen, wenn im gewählten Zeitraum keine gefunden wurden.
const FALLBACK_COUNT = 5;

export function FeedPage() {
  const {
    tools,
    loading,
    refreshing: toolsRefreshing,
    lastCuratedAt,
    refetch,
  } = useTools();
  const {
    news,
    loading: newsLoading,
    refreshing: newsRefreshing,
    error: newsError,
    refetch: refetchNews,
  } = useNews();
  const { prefs, setPrefs } = usePreferences();
  const { favorites, toggleFavorite } = useFavorites();
  const { selected, toggle } = useCompare();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const refreshNow = async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      // Die Suche selbst läuft automatisch im Hintergrund (Vercel); hier
      // holen wir nur den neuesten Stand ab.
      await Promise.all([refetch(), refetchNews()]);
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
  const [ageFilter, setAgeFilter] = useState<AgeFilter>(
    prefs.ageFilter ?? "alle"
  );
  // Gespeicherte Filter übernehmen, sobald die Einstellungen geladen sind
  // (beim ersten Rendern sind sie noch nicht da).
  useEffect(() => {
    setPriceFilter(prefs.priceFilter ?? []);
    setAgeFilter(prefs.ageFilter ?? "alle");
  }, [prefs.priceFilter, prefs.ageFilter]);

  const [expandedCategories, setExpandedCategories] = useState<
    Set<CategoryId>
  >(new Set());
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  const updatePriceFilter = (p: PriceTier[]) => {
    setPriceFilter(p);
    setPrefs({ ...prefs, priceFilter: p, updatedAt: new Date().toISOString() });
  };

  const updateAgeFilter = (a: AgeFilter) => {
    setAgeFilter(a);
    setPrefs({ ...prefs, ageFilter: a, updatedAt: new Date().toISOString() });
  };

  const handleCategoryChange = (c: CategoryId | "alle") => {
    setActiveCategory(c);
    if (c !== "alle") {
      setExpandedCategories((prev) => new Set(prev).add(c));
    }
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

  // Alle Filter außer Bereich und Alter.
  const toolsMatchingBaseFilters = useMemo(() => {
    return tools
      .filter((t) => priceFilter.length === 0 || priceFilter.includes(t.priceTier))
      .filter((t) => t.trustScore >= prefs.minTrustScore)
      .filter((t) => (prefs.categoryWeights[t.categoryId] ?? 2) > 0);
  }, [tools, priceFilter, prefs]);

  // Pro Bereich die Tools im gewählten Zeitraum. Gibt es dort keine, zeigen
  // wir stattdessen die neuesten Funde des Bereichs (mit Hinweis), damit ein
  // Bereich nie leer wirkt, nur weil länger nichts Neues gefunden wurde.
  const categoryTools = useMemo(() => {
    const byNewest = (a: Tool, b: Tool) =>
      new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
    const grouped = {} as Record<CategoryId, Tool[]>;
    for (const t of toolsMatchingBaseFilters) {
      (grouped[t.categoryId] ??= []).push(t);
    }
    const result = {} as Record<
      CategoryId,
      { tools: Tool[]; inRange: number; fallback: boolean }
    >;
    for (const [id, list] of Object.entries(grouped) as [CategoryId, Tool[]][]) {
      list.sort(byNewest);
      const inRange = list.filter((t) => matchesAgeFilter(t.lastUpdated, ageFilter));
      result[id] =
        inRange.length > 0 || list.length === 0
          ? { tools: inRange, inRange: inRange.length, fallback: false }
          : { tools: list.slice(0, FALLBACK_COUNT), inRange: 0, fallback: true };
    }
    return result;
  }, [toolsMatchingBaseFilters, ageFilter]);

  const newsByCategory = useMemo(() => {
    const grouped = {} as Record<CategoryId, NewsItem[]>;
    for (const n of news) (grouped[n.categoryId] ??= []).push(n);
    return grouped;
  }, [news]);

  const visibleCategories = categories.filter(
    (c) => activeCategory === "alle" || c.id === activeCategory
  );
  const totalVisibleTools = visibleCategories.reduce(
    (sum, c) => sum + (categoryTools[c.id]?.tools.length ?? 0),
    0
  );
  const totalVisibleNews = visibleCategories.reduce(
    (sum, c) => sum + (newsByCategory[c.id]?.length ?? 0),
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
            {toolsRefreshing ? "· Suche nach neuen Tools läuft" : "· sortiert nach deinen Gewichtungen"}
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
          onCategoryChange={handleCategoryChange}
          priceFilter={priceFilter}
          onPriceFilterChange={updatePriceFilter}
          ageFilter={ageFilter}
          onAgeFilterChange={updateAgeFilter}
        />
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Lade Tools …</p>
      ) : totalVisibleTools === 0 && totalVisibleNews === 0 && !newsLoading ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--text-muted)]">
          Keine Tools passen zu diesen Filtern. Passe die Preisauswahl an oder
          aktiviere weitere Bereiche in den Einstellungen.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleCategories.map((c) => {
            const catEntry = categoryTools[c.id];
            const catTools = catEntry?.tools ?? [];
            const catNews = newsByCategory[c.id] ?? [];
            const isOpen = expandedCategories.has(c.id);
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
                  {c.label} ({catEntry?.inRange ?? 0})
                  {catNews.length > 0 && (
                    <span className="rounded-full bg-[var(--surface-raised)] px-1.5 py-0.5 text-[11px]">
                      {catNews.length} News
                    </span>
                  )}
                </button>
                {isOpen && (
                  <div
                    className="ml-1.5 mb-2 flex flex-col gap-1 rounded-lg border-l-2 bg-[var(--surface-raised)] p-3 pl-4"
                    style={{ borderColor: c.color }}
                  >
                    <CategoryNews
                      items={catNews}
                      loading={newsLoading}
                      refreshing={newsRefreshing}
                      error={newsError}
                    />
                    {catEntry?.fallback && (
                      <p className="mb-1 text-xs text-[var(--text-muted)]">
                        Im gewählten Zeitraum wurde hier nichts Neues gefunden –
                        das sind die neuesten Funde:
                      </p>
                    )}
                    {catTools.length === 0 && (
                      <p className="text-xs text-[var(--text-muted)]">
                        Keine Tools in diesem Bereich, die zu deiner
                        Preisauswahl passen.
                      </p>
                    )}
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
                              className="focus-ring select-none rounded-md py-1 text-sm text-[var(--text-muted)] hover:text-[var(--text)] hover:underline"
                            >
                              {tool.name}
                            </a>
                            <span className="shrink-0 text-xs text-[var(--text-muted)] opacity-70">
                              · {relativeDe(tool.lastUpdated)}
                            </span>
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
          disabled={refreshing}
          className="focus-ring rounded-md border border-[var(--line)] px-3.5 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {refreshing ? "Aktualisiere …" : "Jetzt aktualisieren"}
        </button>
        {toolsRefreshing && (
          <p className="text-xs text-[var(--text-muted)]">
            Die Suche nach neuen Tools läuft gerade im Hintergrund – das
            dauert ein paar Minuten, der Feed aktualisiert sich von selbst.
          </p>
        )}
        {refreshError && (
          <p className="text-xs text-[var(--danger)]">{refreshError}</p>
        )}
      </div>
    </div>
  );
}
