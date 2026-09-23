import { getKqEquipmentDefinition, getKqEquipmentLevel, getKqEquipmentUpgradeCost, KQ_RETIRED_EQUIPMENT_CODES } from "./kanab-quest-equipment";
import { getKqProductionUnits, KQ_FINAL_WAREHOUSE_PRICE_CENTS } from "./kanab-quest-production-scale";

export { getKqProductionUnits, KQ_PRODUCTION_UNITS, KQ_FINAL_WAREHOUSE_PRICE_CENTS } from "./kanab-quest-production-scale";

export type KqProductionExpansion = ReturnType<typeof getKqProductionExpansion>;

/** All purchased models, including reserves, equip every tent at the same level. */
export function getKqProductionExpansion(requestedUnits: number, purchasedCodes: string[], levels: Record<string, number> = {}) {
  const units = getKqProductionUnits(requestedUnits);
  const nextUnits = units < 4 ? units + 1 : units === 4 ? 8 : null;
  const addedUnits = nextUnits === null ? 0 : nextUnits - units;
  const purchased = [...new Set(purchasedCodes)]
    .filter(code => !KQ_RETIRED_EQUIPMENT_CODES.includes(code))
    .map(getKqEquipmentDefinition)
    .filter(item => item?.purchasable);
  const starterCosts = { tent: 12_000, lighting: 12_000, air: 6_000 } as const;
  let unitEquipmentCostCents = Object.entries(starterCosts).reduce((total, [slot, cost]) => (
    total + (purchased.some(item => item!.slot === slot) ? 0 : cost)
  ), 0);
  for (const item of purchased) {
    if (!item) continue;
    unitEquipmentCostCents += item.priceCents;
    for (let level = 1; level < getKqEquipmentLevel(levels[item.code]); level++) {
      unitEquipmentCostCents += getKqEquipmentUpgradeCost(item.code, level) ?? 0;
    }
  }
  const propertyCostCents = units === 4 ? KQ_FINAL_WAREHOUSE_PRICE_CENTS : 0;
  const equipmentCostCents = unitEquipmentCostCents * addedUnits;
  return {
    units, warehouseCount: units > 4 ? 2 : 1, nextUnits, addedUnits,
    propertyCostCents, unitEquipmentCostCents, equipmentCostCents,
    totalCostCents: propertyCostCents + equipmentCostCents,
  };
}
