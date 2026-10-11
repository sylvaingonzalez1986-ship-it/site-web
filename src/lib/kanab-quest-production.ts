import { getKqEquipmentDefinition, getKqEquipmentBuildingNumber, isKqBuildingEquipment, summarizeKqEquipmentLoadout } from "./kanab-quest-equipment";
import { getKqProductionUnits, KQ_FINAL_WAREHOUSE_PRICE_CENTS, type KqTentEquipmentProfile, type KqEquipmentRunScope } from "./kanab-quest-production-scale";

export { getKqProductionUnits, KQ_PRODUCTION_UNITS, KQ_FINAL_WAREHOUSE_PRICE_CENTS, type KqTentEquipmentProfile } from "./kanab-quest-production-scale";

export const KQ_STARTER_TENT_PRICE_CENTS = 30_000;
export type KqProductionExpansion = ReturnType<typeof getKqProductionExpansion>;

/** Expansion adds independent tents with a starter kit to equip individually. */
export function getKqProductionExpansion(requestedUnits: number, _purchasedCodes: string[] = [], _levels: Record<string, number> = {}) {
  // Retain the previous call signature; upgrades do not alter the capacity price.
  void _purchasedCodes;
  void _levels;
  const units = getKqProductionUnits(requestedUnits);
  const nextUnits = units < 8 ? units + 1 : null;
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

/** Merge building effects into each served tent, without duplicating physical ownership. */
export function getKqEffectiveTentProfiles(input: {
  equipmentScopeVersion?: 2 | 3;
  tents: Array<{ tentNumber: number; cultureOperationalCodes: string[]; levels: Record<string, number> }>;
  buildings?: Array<{ buildingNumber: number; cultureOperationalCodes: string[]; levels: Record<string, number> }>;
}): KqTentEquipmentProfile[] {
  return input.tents.map(tent => {
    const building = input.equipmentScopeVersion === 3
      ? input.buildings?.find(item => item.buildingNumber === getKqEquipmentBuildingNumber(tent.tentNumber)) : undefined;
    return { tentNumber: tent.tentNumber,
      codes: [...new Set([...tent.cultureOperationalCodes, ...(building?.cultureOperationalCodes ?? [])])],
      levels: { ...tent.levels, ...building?.levels } };
  });
}

/** Tent effects are averaged; workshop and building power count physical devices once. */
export function summarizeKqTentEquipment(tents: KqTentEquipmentProfile[], shared?: Pick<KqTentEquipmentProfile, "codes" | "levels">, scope?: KqEquipmentRunScope) {
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
  const duplicateServiceTents = scope === "building" ? tents.filter(tent => (tent.tentNumber - 1) % 4 !== 0) : tents.slice(1);
  const servicePower = scope === "installation" || scope === "building" ? duplicateServiceTents.reduce((sum, tent) => sum + summarizeKqEquipmentLoadout(
    tent.codes.filter(code => ["energy", "security", "flower-drying"].includes(getKqEquipmentDefinition(code)?.slot ?? "")), tent.levels,
  ).powerWatts, 0) : 0;
  summary.powerWatts = summaries.reduce((sum, item) => sum + item.powerWatts, 0) - commonPower * (summaries.length - 1) - servicePower;
  // A common culture is fully protected only when each tent has that protection.
  summary.unlocks = summaries[0].unlocks.filter(unlock => summaries.every(item => item.unlocks.includes(unlock)));
  return summary;
}

/** Frozen building profiles must have identical services and levels within each building. */
export function areKqBuildingServicesConsistent(tents: KqTentEquipmentProfile[]): boolean {
  return tents.every(tent => {
    const anchor = tents.find(item => item.tentNumber === (getKqEquipmentBuildingNumber(tent.tentNumber) - 1) * 4 + 1);
    if (!anchor) return false;
    const services = tent.codes.filter(isKqBuildingEquipment);
    const expected = anchor.codes.filter(isKqBuildingEquipment);
    return services.length === expected.length && services.every(code => expected.includes(code) && tent.levels[code] === anchor.levels[code]);
  });
}
