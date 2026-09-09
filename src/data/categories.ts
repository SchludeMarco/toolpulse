import type { Category } from "../types";

// Ein Eintrag hier + eine passende Ergänzung in `functions/index.js`
// (Konstante `CATEGORIES`) reicht, um einen neuen Themenbereich
// hinzuzufügen — der Rest der App (Feed, Filter, Digest, Einstellungen)
// liest Bereiche ausschließlich aus dieser Liste.
export const categories: Category[] = [
  {
    id: "llm",
    label: "Beste LLMs",
    description:
      "Sprachmodelle und Chat-Assistenten: was Entwickler und Power-User gerade als führend einstufen",
    color: "var(--cat-llm)",
  },
  {
    id: "ki-bild",
    label: "KI-Bildgenerierung",
    description: "Modelle, Editoren und Tools zum Entwerfen von Bildern per KI",
    color: "var(--cat-bild)",
  },
  {
    id: "dev-trends",
    label: "Dev-Trends",
    description:
      "Frameworks, Sprachen, Libraries und Tools, die auf GitHub, Hacker News & Co. gerade Fahrt aufnehmen",
    color: "var(--cat-dev)",
  },
  {
    id: "design-trends",
    label: "Design-Trends",
    description:
      "UI/UX-Trends, Design-Tools und Inspiration von Designer-Portalen wie Awwwards, Dribbble und Behance",
    color: "var(--cat-design)",
  },
];

export const categoryById = (id: string) =>
  categories.find((c) => c.id === id);
