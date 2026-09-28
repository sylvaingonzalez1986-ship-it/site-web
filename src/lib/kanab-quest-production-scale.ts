export const KQ_PRODUCTION_UNITS = [1, 2, 3, 4, 8] as const;
export const KQ_FINAL_WAREHOUSE_PRICE_CENTS = 2_000_000;

/** Historical installations and saves contain a single tent. */
export function getKqProductionUnits(value?: number): number {
  return KQ_PRODUCTION_UNITS.some(units => units === value) ? value! : 1;
}

/** Effective equipment for a physical tent; older runs may retain distinct profiles. */
export type KqTentEquipmentProfile = {
  tentNumber: number;
  codes: string[];
  levels: Record<string, number>;
};
