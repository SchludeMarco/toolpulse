export function relativeDe(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - then);
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.floor(h / 24);
  if (d < 7) return `vor ${d} Tag${d === 1 ? "" : "en"}`;
  const w = Math.floor(d / 7);
  if (w < 5) return `vor ${w} Woche${w === 1 ? "" : "n"}`;
  const mo = Math.floor(d / 30);
  return `vor ${mo} Monat${mo === 1 ? "" : "en"}`;
}

export function formatDateDe(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
