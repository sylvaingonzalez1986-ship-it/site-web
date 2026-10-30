import firstVarieties from "@/data/buddie-varieties/001-026.json";
import lastVarieties from "@/data/buddie-varieties/027-052.json";

/** Strain history and pedigrees, scoped to the breeder's selection where needed. */
export type KqBuddieVariety = Readonly<{
  code: string;
  identity: "documented" | "commercial-name" | "fiction";
  history: string;
  origin: string;
  lineage: string;
  /** Breeder records, named firsthand accounts, archives and corroborating references. */
  sources: readonly Readonly<{ label: string; url: string }>[];
  reviewedAt: string;
}>;

export const KQ_BUDDIE_VARIETIES: readonly KqBuddieVariety[] = [
  ...firstVarieties,
  ...lastVarieties,
] as KqBuddieVariety[];

const varietiesByCode = new Map(KQ_BUDDIE_VARIETIES.map(variety => [variety.code, variety]));

export function getKqBuddieVariety(code: string): KqBuddieVariety | undefined {
  return varietiesByCode.get(code);
}
