/** Real commercial identities, kept separate from fictional game balance. */
export const KQ_WAREHOUSE_REFERENCE_FAMILIES = [
  { code: "lighting", label: "Éclairage" },
  { code: "air", label: "Extraction" },
  { code: "water", label: "Irrigation" },
  { code: "climate", label: "Climat" },
  { code: "control", label: "Pilotage" },
  { code: "hygiene", label: "Hygiène" },
  { code: "logistics", label: "Manutention" },
  { code: "security", label: "Sécurité" },
  { code: "substrate", label: "Supports" },
  { code: "nutrition", label: "Nutrition" },
  { code: "drying", label: "Séchage" },
  { code: "storage", label: "Stockage" },
  { code: "workshop", label: "Machines d’atelier" },
] as const;

export type KqWarehouseReferenceFamily = typeof KQ_WAREHOUSE_REFERENCE_FAMILIES[number]["code"];

export type KqWarehouseCommercialReference = {
  id: string;
  brand: string;
  name: string;
  category: string;
  family: KqWarehouseReferenceFamily;
  formats: string;
  observedPriceCents: number | null;
  currency: "EUR" | "USD" | "CAD" | null;
  priceKind: "observed" | "quote" | "unlisted";
  priceNote: string;
  sourceUrl: string;
  checkedAt: string;
  /** Verified commercial features only; never fictional bonuses or growing settings. */
  features: string[];
  /** Comparison limitation or practical tradeoff, without invented performance claims. */
  tradeoff: string;
};
