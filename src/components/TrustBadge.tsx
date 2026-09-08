export function TrustBadge({ score }: { score: number }) {
  const level =
    score >= 85 ? "hoch" : score >= 65 ? "solide" : "ungeprüft";
  const color =
    score >= 85
      ? "var(--teal)"
      : score >= 65
        ? "var(--amber)"
        : "var(--text-muted)";

  return (
    <div
      className="flex items-center gap-1.5 text-xs"
      title={`Vertrauenswert: ${score}/100 — basierend auf Quellenanzahl, Aktualität und Übereinstimmung`}
    >
      <div className="flex h-1 w-10 overflow-hidden rounded-full bg-[var(--line)]">
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span style={{ color }}>{level}</span>
    </div>
  );
}
