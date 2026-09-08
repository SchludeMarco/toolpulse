import type { Tool } from "../types";
import { categoryById } from "../data/categories";
import { TrustBadge } from "./TrustBadge";
import { relativeDe } from "../lib/time";

const priceLabel: Record<Tool["priceTier"], string> = {
  kostenlos: "Kostenlos",
  freemium: "Freemium",
  abo: "Abo",
  einmalig: "Einmalig",
};

interface Props {
  tool: Tool;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onSelectCompare?: (id: string) => void;
  compareSelected?: boolean;
}

export function ToolCard({
  tool,
  isFavorite,
  onToggleFavorite,
  onSelectCompare,
  compareSelected,
}: Props) {
  const cat = categoryById(tool.categoryId);

  return (
    <article className="group relative flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--line)] hover:bg-[var(--surface-raised)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: cat?.color }}
          />
          <span className="text-xs text-[var(--text-muted)]">
            {cat?.label}
          </span>
          {tool.isNew && (
            <span className="rounded-full bg-[var(--teal)]/15 px-2 py-0.5 text-[11px] font-medium text-[var(--teal)]">
              Neu entdeckt
            </span>
          )}
        </div>
        <button
          onClick={() => onToggleFavorite(tool.id)}
          aria-label={
            isFavorite ? "Von Merkliste entfernen" : "Zur Merkliste hinzufügen"
          }
          className="focus-ring rounded-md p-1 text-lg leading-none text-[var(--text-muted)] hover:text-[var(--amber)]"
        >
          {isFavorite ? "★" : "☆"}
        </button>
      </div>

      <div>
        <h3 className="text-base font-semibold">{tool.name}</h3>
        <p className="mt-0.5 text-sm text-[var(--text-muted)]">
          {tool.tagline}
        </p>
      </div>

      <p className="text-sm leading-relaxed text-[var(--text)]/85">
        {tool.description}
      </p>

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--text-muted)]">
        <span className="rounded border border-[var(--line)] px-2 py-0.5">
          {priceLabel[tool.priceTier]}
          {tool.priceDetail ? ` · ${tool.priceDetail}` : ""}
        </span>
        <TrustBadge score={tool.trustScore} />
        <span>Aktualisiert {relativeDe(tool.lastUpdated)}</span>
      </div>

      <div className="mt-1 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
        <a
          href={tool.url}
          target="_blank"
          rel="noreferrer"
          className="focus-ring rounded-md bg-[var(--surface-raised)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--line)]"
        >
          Öffnen
        </a>
        {onSelectCompare && (
          <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={!!compareSelected}
              onChange={() => onSelectCompare(tool.id)}
              className="focus-ring accent-[var(--amber)]"
            />
            Vergleichen
          </label>
        )}
      </div>
    </article>
  );
}
