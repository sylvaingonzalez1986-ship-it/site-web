import type { KqOfficialFlower, KqStorageSnapshot } from "./kanab-quest-api";

export type KqHarvestState = "overflow" | "storage" | "jury" | "queued" | "duel" | "curing" | "ready" | "empty";
export type KqHarvestMarketSection = "sales" | "dashboard";
export type KqHarvestRow = {
  id: string;
  name: string;
  state: KqHarvestState;
  flower?: KqOfficialFlower;
  lot?: KqStorageSnapshot["lots"][number];
};
const order: Record<KqHarvestState, number> = { overflow: 0, storage: 1, jury: 2, duel: 3, queued: 4, ready: 5, curing: 6, empty: 7 };
const knownAmount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

export function isKqHarvestBeforeJury(lot: Pick<StorageLot, "flowerStatus">) {
  return lot.flowerStatus !== "burned";
}

/** The journey stage stays available even when surplus takes priority in the list. */
export function getKqHarvestStep(status: string, projection?: StorageLot["projection"]): Exclude<KqHarvestState, "overflow"> {
  if (!["available", "queued", "locked", "burned"].includes(status)) return "storage";
  if (status === "queued") return "queued";
  if (status === "locked") return "duel";
  const total = projection?.capacity?.totalUnits;
  if (status === "burned" && total === 0) return "empty";
  if (!projection || !["ready", "curing"].includes(projection.stage)) return "storage";
  if (status === "burned" && (!knownAmount(total) || !knownAmount(projection.capacity?.overflowUnits))) return "storage";
  if (projection.stage === "curing") return "curing";
  return status === "burned" ? "ready" : "jury";
}

function harvestState(status: string, projection?: StorageLot["projection"]): KqHarvestState {
  const overflow = projection?.capacity?.overflowUnits;
  if (knownAmount(overflow) && overflow > 0) return "overflow";
  return getKqHarvestStep(status, projection);
}

export function isKqHarvestAtJury(row: KqHarvestRow) {
  const step = getKqHarvestStep(row.lot?.flowerStatus ?? row.flower?.status ?? "unknown", row.lot?.projection ?? row.flower?.storage);
  return step === "jury" || step === "queued" || step === "duel";
}

type HarvestAction = { destination: "storage"; label: string }
  | { destination: "arena"; label: string }
  | { destination: "market"; label: string; section: KqHarvestMarketSection };

export function getKqHarvestActions(row: KqHarvestRow): HarvestAction[] {
  const status = row.lot?.flowerStatus ?? row.flower?.status ?? "unknown";
  const step = getKqHarvestStep(status, row.lot?.projection ?? row.flower?.storage);
  const overflow = row.state === "overflow";
  const actions: HarvestAction[] = [];
  if (overflow) actions.push({ destination: "storage", label: "Protéger le surplus" });
  if (step === "jury" || step === "queued" || step === "duel") {
    actions.push({ destination: "arena", label: step === "jury" ? "Présenter au jury" : "Suivre le duel" });
  } else if (step === "empty") {
    actions.push({ destination: "market", section: "dashboard", label: "Voir mon stock en vente" });
  } else if (status === "burned" && (step === "ready" || step === "curing")) {
    actions.push({ destination: "market", section: "sales", label: step === "ready" && !overflow ? "Préparer la vente" : "Voir l’offre grossiste" });
  }
  if (!overflow && step !== "empty" && (row.lot || !isKqHarvestAtJury(row))) {
    actions.push({ destination: "storage", label: step === "storage" ? "Vérifier le stockage" : isKqHarvestAtJury(row) ? "Voir le stockage" : "Gérer le stockage" });
  }
  return actions;
}

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
    const state = harvestState(lot.flowerStatus, lot.projection);
    rows.set(lot.flowerId, { id: lot.flowerId, name: lot.varietyName, state, lot });
  }
  for (const flower of flowers) {
    if (flower.status === "burned" || rows.has(flower.id)) continue;
    rows.set(flower.id, { id: flower.id, name: flower.varietyName, state: harvestState(flower.status, flower.storage), flower });
  }
  return [...rows.values()].sort((a, b) => order[a.state] - order[b.state]);
}
