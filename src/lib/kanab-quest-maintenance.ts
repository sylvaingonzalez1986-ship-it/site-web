import { getKqEquipmentDefinition } from "./kanab-quest-equipment";
import type { ChanvrierStrength } from "./arena-chanvrier";

export type KqMachineCondition = { cycles: number; interval: number; remaining: number; due: boolean; repairCents: number; version: number };
export function getKqMachineCondition(code: string, level: number, cycles: number, version = 0, strength?: ChanvrierStrength | null): KqMachineCondition | null {
  const item = getKqEquipmentDefinition(code);
  if (!item || item.category !== "processing" || code === "SIFT-TRAY") return null;
  const safeLevel = Math.max(1, Math.min(10, Math.floor(level)));
  const interval = safeLevel >= 5 || code === "FREEZE-DRYER" ? 20 : 10;
  const used = Math.max(0, Math.floor(cycles));
  const repairCents = strength === "handyperson" ? 0 : Math.min(20000, Math.max(1000, Math.ceil(item.priceCents * 6 * (100 + (safeLevel - 1) * 5) / 10000)));
  return { cycles: used, interval, remaining: Math.max(0, interval - used), due: used >= interval, repairCents, version };
}
