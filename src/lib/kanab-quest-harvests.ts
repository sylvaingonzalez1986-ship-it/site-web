import type { KqOfficialFlower, KqStorageSnapshot } from "./kanab-quest-api";

export type KqHarvestState = "overflow" | "jury" | "queued" | "duel" | "curing" | "ready";
export type KqHarvestRow = {
  id: string;
  name: string;
  state: KqHarvestState;
  flower?: KqOfficialFlower;
  lot?: KqStorageSnapshot["lots"][number];
};
const order: Record<KqHarvestState, number> = { overflow: 0, jury: 1, duel: 2, queued: 3, ready: 4, curing: 5 };

/** Keep one identity per harvest, and use server state rather than the device clock. */
export function getKqHarvestRows(flowers: readonly KqOfficialFlower[], storage: KqStorageSnapshot | null): KqHarvestRow[] {
  const rows = new Map<string, KqHarvestRow>();
  for (const lot of storage?.lots ?? []) {
    const state = (lot.projection.capacity?.overflowUnits ?? 0) > 0 ? "overflow" : lot.projection.stage === "ready" ? "ready" : "curing";
    rows.set(lot.flowerId, { id: lot.flowerId, name: lot.varietyName, state, lot });
  }
  for (const flower of flowers) {
    if (flower.status === "burned" || rows.has(flower.id)) continue;
    rows.set(flower.id, { id: flower.id, name: flower.varietyName, state: flower.status === "available" ? "jury" : flower.status === "queued" ? "queued" : "duel", flower });
  }
  return [...rows.values()].sort((a, b) => order[a.state] - order[b.state]);
}
