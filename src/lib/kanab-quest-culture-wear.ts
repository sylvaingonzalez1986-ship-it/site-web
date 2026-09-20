import { getKqEquipmentDefinition, getKqEquipmentLevel, KQ_STARTING_EQUIPMENT_CODES } from "./kanab-quest-equipment";
import type { KqEnergyMode } from "./kanab-quest-energy";

// Permanent wear per completed culture. Keep the SQL schedule in sync.
export const KQ_CULTURE_WEAR_RATES: Record<string, Record<KqEnergyMode, number>> = {
  "LED-300": { eco: 2, balanced: 5, intensive: 10 },
  "AIR-EC6": { eco: 1, balanced: 3, intensive: 6 },
  "CLIMATE-SMART": { eco: 1, balanced: 2, intensive: 4 },
  "TENT-120": { eco: 1, balanced: 2, intensive: 3 },
  "DRYING-ROOM": { eco: 1, balanced: 2, intensive: 4 },
  "SOLAR-BACKUP": { eco: 1, balanced: 2, intensive: 4 },
  "SECURITY-CAMERA": { eco: 1, balanced: 1, intensive: 1 },
};

export type KqCultureEquipmentCondition = {
  wearPercent: number;
  conditionPercent: number;
  version: number;
  due: boolean;
  replacementCents: number;
};

export function getKqCultureEquipmentCondition(code: string, level = 1, wearPercent = 0, version = 0): KqCultureEquipmentCondition | null {
  const item = getKqEquipmentDefinition(code);
  if (!Object.hasOwn(KQ_CULTURE_WEAR_RATES, code) || !item?.purchasable) return null;
  const wear = Number.isFinite(wearPercent) ? Math.max(0, Math.min(100, Math.trunc(wearPercent))) : 0;
  return {
    wearPercent: wear, conditionPercent: 100 - wear,
    version: Number.isSafeInteger(version) && version >= 0 ? version : 0,
    due: wear === 100,
    replacementCents: Math.ceil(item.priceCents * (100 + (getKqEquipmentLevel(level) - 1) * 10) / 100),
  };
}

export function getKqCultureWearAmount(code: string, wearPercent: number, mode: KqEnergyMode): number {
  if (!Object.hasOwn(KQ_CULTURE_WEAR_RATES, code) || wearPercent >= 100) return 0;
  const rate = KQ_CULTURE_WEAR_RATES[code][mode];
  return Math.min(100 - wearPercent, mode === "intensive" && wearPercent > 70 ? Math.ceil(rate * 1.5) : rate);
}

export function getKqCultureWearPreview(code: string, condition: KqCultureEquipmentCondition, mode: KqEnergyMode) {
  const item = getKqEquipmentDefinition(code);
  if (!item || !Object.hasOwn(KQ_CULTURE_WEAR_RATES, code)) return null;
  const wearPercent = getKqCultureWearAmount(code, condition.wearPercent, mode);
  let wear = condition.wearPercent;
  let cyclesRemaining = 0;
  while (wear < 100) {
    wear += getKqCultureWearAmount(code, wear, mode);
    cyclesRemaining++;
  }
  return {
    code, name: item.name, conditionBefore: condition.conditionPercent,
    conditionAfter: Math.max(0, condition.conditionPercent - wearPercent), wearPercent,
    accelerated: !condition.due && mode === "intensive" && condition.conditionPercent < 30,
    cyclesRemaining, replacementCents: condition.replacementCents,
    wearCostCents: Math.round(condition.replacementCents * wearPercent / 100),
  };
}

/** Broken purchases stay owned; starter equipment takes over essential empty slots. */
export function getKqCultureOperationalCodes(equippedCodes: string[], conditions: Record<string, KqCultureEquipmentCondition> = {}): string[] {
  const codes = [...new Set(equippedCodes)].filter(code => !conditions[code]?.due);
  for (const starter of KQ_STARTING_EQUIPMENT_CODES) {
    const slot = getKqEquipmentDefinition(starter)?.slot;
    if (!codes.some(code => getKqEquipmentDefinition(code)?.slot === slot)) codes.push(starter);
  }
  return codes;
}
