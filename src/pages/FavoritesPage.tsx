import { useTools } from "../hooks/useTools";
import { useFavorites } from "../hooks/useFavorites";
import { ToolCard } from "../components/ToolCard";
import { formatDateDe } from "../lib/time";

export function FavoritesPage() {
  const { tools } = useTools();
  const { favorites, toggleFavorite } = useFavorites();

  const items = favorites
    .map((f) => ({ fav: f, tool: tools.find((t) => t.id === f.toolId) }))
    .filter((x) => x.tool);

  const dueForReview = items.filter(
    (x) => new Date(x.fav.reviewAt).getTime() <= Date.now()
  );

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <h1 className="display text-2xl font-semibold tracking-tight">
        Merkliste
      </h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Gemerkte Tools werden nach 30 Tagen automatisch zur erneuten Prüfung
        vorgeschlagen — ist die Empfehlung noch aktuell?
      </p>

      {dueForReview.length > 0 && (
        <div className="mt-4 rounded-lg border border-[var(--amber)]/40 bg-[var(--amber)]/10 px-4 py-3 text-sm text-[var(--amber)]">
          {dueForReview.length} Tool{dueForReview.length === 1 ? "" : "s"} bereit
          zur erneuten Prüfung.
        </div>
      )}

      {items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--text-muted)]">
          Noch nichts gemerkt. Markiere Tools im Feed mit ☆.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ fav, tool }) => (
            <div key={fav.toolId}>
              <ToolCard
                tool={tool!}
                isFavorite
                onToggleFavorite={toggleFavorite}
              />
              <p className="mt-2 px-1 text-xs text-[var(--text-muted)]">
                Nächste Prüfung: {formatDateDe(fav.reviewAt)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
