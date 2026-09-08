import type { Category } from "../types";

export const categories: Category[] = [
  {
    id: "ki",
    label: "KI & LLMs",
    description: "Modelle, Assistenten und Entwickler-Tools rund um KI",
    color: "var(--cat-ai)",
  },
  {
    id: "bilder",
    label: "Bilder",
    description: "KI-Bildgenerierung: Modelle, Editoren, Upscaler",
    color: "var(--cat-bilder)",
  },
  {
    id: "haushalt",
    label: "Haushalt",
    description: "Organisation, Smart Home, Erledigungen",
    color: "var(--cat-haushalt)",
  },
  {
    id: "essen",
    label: "Essen & Trinken",
    description: "Rezepte, Lieferdienste, Ernährungs-Tools",
    color: "var(--cat-essen)",
  },
  {
    id: "freizeit",
    label: "Freizeit",
    description: "Hobbys, Reisen, Unterhaltung",
    color: "var(--cat-freizeit)",
  },
  {
    id: "kinder",
    label: "Kinder",
    description: "Lernen, Betreuung, familienfreundliche Apps",
    color: "var(--cat-kinder)",
  },
];

export const categoryById = (id: string) =>
  categories.find((c) => c.id === id);
