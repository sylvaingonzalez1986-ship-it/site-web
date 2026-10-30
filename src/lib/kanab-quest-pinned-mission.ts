import { KQ_MISSION_DEFINITIONS, type KqMission, type KqMissionCode, type KqMissionDestination } from "./kanab-quest-missions";

type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;
export const kqPinnedMissionKey = (ownerId: string) => `kq-pinned-mission-v1:${encodeURIComponent(ownerId)}`;
export const isKqMissionCode = (value: unknown): value is KqMissionCode =>
  typeof value === "string" && KQ_MISSION_DEFINITIONS.some(mission => mission.code === value);

export function readKqPinnedMission(storage: PreferenceStorage, ownerId: string): { code: KqMissionCode | null; unavailable: boolean } {
  try {
    const raw = storage.getItem(kqPinnedMissionKey(ownerId));
    if (raw === null) return { code: null, unavailable: false };
    const saved: unknown = JSON.parse(raw);
    const row = saved && typeof saved === "object" ? saved as Record<string, unknown> : null;
    return { code: row?.version === 1 && isKqMissionCode(row.code) ? row.code : null, unavailable: false };
  } catch { return { code: null, unavailable: true }; }
}

export function writeKqPinnedMission(storage: PreferenceStorage, ownerId: string, code: KqMissionCode | null): boolean {
  try { storage.setItem(kqPinnedMissionKey(ownerId), JSON.stringify({ version: 1, code })); return true; }
  catch { return false; }
}

/** Missing or malformed progress must not become a zero or a completed objective. */
export function readKqPinnedMissionProgress(value: unknown, code: KqMissionCode): KqMission | null {
  if (!value || typeof value !== "object" || !Array.isArray((value as { missions?: unknown }).missions)) return null;
  const mission = ((value as { missions: unknown[] }).missions).find(row => row && typeof row === "object" && (row as { code?: unknown }).code === code);
  if (!mission || typeof mission !== "object") return null;
  const row = mission as KqMission;
  return Number.isFinite(row.progress) && row.progress >= 0 && Number.isFinite(row.target) && row.target > 0
    && typeof row.claimable === "boolean" && typeof row.claimed === "boolean" && typeof row.unlocked === "boolean" ? row : null;
}

export type KqMissionTarget = { view: KqMissionDestination; options?: { harvestSection?: "storage"; marketSection?: "sales" | "dashboard" | "demands" } };
/** A mission opens the place where the decision is made, not merely the equipment room. */
export function getKqMissionTarget(code: KqMissionCode): KqMissionTarget {
  const definition = KQ_MISSION_DEFINITIONS.find(item => item.code === code)!;
  if (["cured_lots", "quality_cured_lots"].includes(definition.metric)) return { view: "harvests", options: { harvestSection: "storage" } };
  if (["transformed_batches", "transformed_routes", "prepared_batches"].includes(definition.metric)) return { view: "market", options: { marketSection: "sales" } };
  if (["online_dual_aroma_sales", "online_satisfied_dual_aroma_periods"].includes(definition.metric)) return { view: "market", options: { marketSection: "demands" } };
  if (definition.track === "online") return { view: "market", options: { marketSection: "dashboard" } };
  if (definition.destination === "market") return { view: "market", options: { marketSection: "sales" } };
  return { view: definition.destination };
}
