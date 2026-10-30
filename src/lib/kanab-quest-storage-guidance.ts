import type { KqStorageSnapshot } from "./kanab-quest-api";

export type KqStorageJuryStage = "before-jury" | "after-jury" | "unknown";

/** Curing maturity alone never establishes whether a harvest has been judged. */
export function getKqStorageJuryStage(flowerStatus: unknown): KqStorageJuryStage {
  if (flowerStatus === "burned") return "after-jury";
  if (flowerStatus === "available" || flowerStatus === "queued" || flowerStatus === "locked") return "before-jury";
  return "unknown";
}

/** Explain the full reported surplus only when every exposed lot is accounted for. */
export function getKqOverflowJuryStage(lots: KqStorageSnapshot["lots"], expectedUnits: number): KqStorageJuryStage | "mixed" {
  if (!Array.isArray(lots) || !Number.isFinite(expectedUnits) || expectedUnits <= 0) return "unknown";
  const stages = new Set<KqStorageJuryStage>();
  let total = 0;
  for (const lot of lots) {
    const units = lot?.projection?.capacity?.overflowUnits;
    if (typeof units !== "number" || !Number.isFinite(units) || units < 0) return "unknown";
    if (units === 0) continue;
    total += units;
    stages.add(getKqStorageJuryStage(lot.flowerStatus));
  }
  if (Math.abs(total - expectedUnits) > Math.max(1, total, expectedUnits) * 1e-9 || stages.has("unknown")) return "unknown";
  if (stages.size > 1) return "mixed";
  return stages.values().next().value ?? "unknown";
}
