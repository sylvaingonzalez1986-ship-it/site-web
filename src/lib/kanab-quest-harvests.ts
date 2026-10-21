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

type StorageLot = KqStorageSnapshot["lots"][number];
export type KqStorageHarvestAdvice = { kind: "curing"; lot: StorageLot; readyAt: string }
  | { kind: "overflow" | "ready" | "refresh"; lot: StorageLot; readyAt: null };

function storagePriority(lot: StorageLot) {
  return (lot.projection.capacity?.overflowUnits ?? 0) > 0 ? 0 : lot.projection.stage === "ready" ? 1 : 2;
}

function storageDate(lot: StorageLot) {
  const date = storagePriority(lot) === 0 ? lot.projection.capacity?.overflowDeadlineAt : lot.projection.readyAt;
  const timestamp = typeof date === "string" ? Date.parse(date) : NaN;
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

/** Surface the next useful lot without advancing its state on the player's device. */
export function getKqStorageHarvestOverview(storage: KqStorageSnapshot | null): {
  lots: StorageLot[];
  advice: KqStorageHarvestAdvice | null;
} {
  const lots = [...(storage?.lots ?? [])].sort((a, b) => {
    const priority = storagePriority(a) - storagePriority(b);
    if (priority) return priority;
    const left = storageDate(a), right = storageDate(b);
    return left === right ? 0 : left < right ? -1 : 1;
  });
  const lot = lots[0];
  const serverNow = storage ? Date.parse(storage.serverNow) : NaN;
  if (!lot || !Number.isFinite(serverNow)) return { lots, advice: null };

  const { projection } = lot;
  const overflow = projection.capacity?.overflowUnits;
  let advice: KqStorageHarvestAdvice;
  if (typeof overflow === "number" && overflow > 0) advice = { kind: "overflow", lot, readyAt: null };
  else if (projection.stage === "ready" && overflow === 0) advice = { kind: "ready", lot, readyAt: null };
  else if (projection.stage === "curing" && Number.isFinite(Date.parse(projection.readyAt)) && Date.parse(projection.readyAt) > serverNow) {
    advice = { kind: "curing", lot, readyAt: projection.readyAt };
  } else advice = { kind: "refresh", lot, readyAt: null };
  return { lots, advice };
}

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
