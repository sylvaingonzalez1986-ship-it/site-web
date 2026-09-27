import { summarizeKqEquipmentLoadout } from "./kanab-quest-equipment";
import { getKqProductionUnits, KQ_FINAL_WAREHOUSE_PRICE_CENTS, type KqTentEquipmentProfile } from "./kanab-quest-production-scale";

export { getKqProductionUnits, KQ_PRODUCTION_UNITS, KQ_FINAL_WAREHOUSE_PRICE_CENTS, type KqTentEquipmentProfile } from "./kanab-quest-production-scale";

export const KQ_STARTER_TENT_PRICE_CENTS = 30_000;
export type KqProductionExpansion = ReturnType<typeof getKqProductionExpansion>;

/** Each additional tent starts with its own basic kit, regardless of existing upgrades. */
export function getKqProductionExpansion(requestedUnits: number, _purchasedCodes: string[] = [], _levels: Record<string, number> = {}) {
  // Retain the previous call signature; owned models never affect a new basic kit.
  void _purchasedCodes;
  void _levels;
  const units = getKqProductionUnits(requestedUnits);
  const nextUnits = units < 4 ? units + 1 : units === 4 ? 8 : null;
  const addedUnits = nextUnits === null ? 0 : nextUnits - units;
  const unitEquipmentCostCents = KQ_STARTER_TENT_PRICE_CENTS;
  const propertyCostCents = units === 4 ? KQ_FINAL_WAREHOUSE_PRICE_CENTS : 0;
  const equipmentCostCents = unitEquipmentCostCents * addedUnits;
  return {
    units, warehouseCount: units > 4 ? 2 : 1, nextUnits, addedUnits,
    propertyCostCents, unitEquipmentCostCents, equipmentCostCents,
    totalCostCents: propertyCostCents + equipmentCostCents,
  };
}

/** Shared culture effects are averaged; installed electrical power is additive. */
export function summarizeKqTentEquipment(tents: KqTentEquipmentProfile[], shared?: Pick<KqTentEquipmentProfile, "codes" | "levels">) {
  const summaries = tents.map(tent => summarizeKqEquipmentLoadout(
    shared ? [...tent.codes, ...shared.codes] : tent.codes,
    shared ? { ...tent.levels, ...shared.levels } : tent.levels,
  ));
  const summary = summarizeKqEquipmentLoadout([]);
  if (!summaries.length) return summary;
  for (const field of ["quantityPercent", "qualityMaxBonus", "regularityPercent", "pressureDelta", "energyDiscountPercent", "processingPrecision", "processingCapacityPercent"] as const) {
    summary[field] = summaries.reduce((sum, item) => sum + item[field], 0) / summaries.length;
  }
  const commonPower = shared ? summarizeKqEquipmentLoadout(shared.codes, shared.levels).powerWatts : 0;
  summary.powerWatts = summaries.reduce((sum, item) => sum + item.powerWatts, 0) - commonPower * (summaries.length - 1);
  // A common culture is fully protected only when each tent has that protection.
  summary.unlocks = summaries[0].unlocks.filter(unlock => summaries.every(item => item.unlocks.includes(unlock)));
  return summary;
}
