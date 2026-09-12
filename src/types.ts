export type CategoryId =
  | "llm"
  | "ki-bild"
  | "dev-trends"
  | "design-trends";

export interface Category {
  id: CategoryId;
  label: string;
  description: string;
  color: string; // css var name, e.g. var(--cat-llm)
}

export type PriceTier = "kostenlos" | "freemium" | "abo" | "einmalig";

export interface Source {
  name: string;
  url: string;
}

export interface Tool {
  id: string;
  name: string;
  categoryId: CategoryId;
  tagline: string; // one-line, plain description of what it does
  description: string;
  url: string;
  priceTier: PriceTier;
  priceDetail?: string; // e.g. "ab 9€/Monat"
  trustScore: number; // 0-100, derived from source diversity + recency + corroboration
  sources: Source[];
  firstSeen: string; // ISO date
  lastUpdated: string; // ISO date
  isNew?: boolean; // surfaced in the last curation run
  tags: string[];
}

export interface UserPreferences {
  uid: string;
  categoryWeights: Record<CategoryId, number>; // 0-3, 0 = ausgeblendet
  priceFilter: PriceTier[]; // empty = alle
  minTrustScore: number;
  digestFrequency: "täglich" | "wöchentlich";
  updatedAt: string;
}

export interface FavoriteEntry {
  toolId: string;
  addedAt: string;
  reviewAt: string; // "in 30 Tagen erneut prüfen"
  note?: string;
}

export interface CurationRun {
  id: string;
  ranAt: string;
  toolsAdded: number;
  toolsUpdated: number;
  categoriesTouched: CategoryId[];
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Watch {
  id: string;
  categoryId: CategoryId;
  query: string; // Freitext-Bedingung, z.B. "Ein neues Tool wird im IT-Sektor plötzlich sehr viel genutzt"
  active: boolean;
  createdAt: string;
  lastCheckedAt?: string;
  lastTriggeredAt?: string;
}
