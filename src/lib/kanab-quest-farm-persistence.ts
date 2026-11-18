import { KQ_FARM_GUIDE_KEY } from "./kanab-quest-farm-guide";
import { emptyFarmProgress, parseFarmProgress, type FarmProgress } from "./kanab-quest-farm-progress";

type FarmStorage = Pick<Storage, "getItem" | "setItem">;
type FarmPreference = { version: 1; active: boolean; started: boolean; collapsed: boolean };
export type FarmProgressLoad = { state: FarmProgress; writable: boolean; warning: boolean };
export const farmProgressStorageKey = (ownerId?: string) => `${KQ_FARM_GUIDE_KEY}:${ownerId ?? "guest"}`;
export const farmPreferenceStorageKey = (ownerId?: string) => `${farmProgressStorageKey(ownerId)}:preference`;

function parsePreference(raw: string | null): FarmPreference | null {
  if (raw === null) return null;
  try {
    const row = JSON.parse(raw);
    return row?.version === 1 && typeof row.active === "boolean" && typeof row.started === "boolean" && typeof row.collapsed === "boolean"
      ? { version: 1, active: row.active, started: row.started, collapsed: row.collapsed } : null;
  } catch { return null; }
}

/** An automatic welcome may start a new guide, but cannot undo a saved pause. */
export function initializeFarmProgress(raw: string | null, initialOpen = false, preferenceRaw: string | null = null): FarmProgressLoad {
  const parsed = parseFarmProgress(raw);
  const preference = parsePreference(preferenceRaw);
  const saved = parsed ?? emptyFarmProgress();
  const mayAutoOpen = raw === null && preferenceRaw === null && initialOpen;
  return {
    state: { ...saved, ...(mayAutoOpen ? { active: true, started: true } : {}),
      ...(preference ? { active: preference.active, started: saved.started || preference.started || preference.active, collapsed: preference.collapsed } : {}) },
    writable: parsed !== null,
    warning: parsed === null || preferenceRaw !== null && preference === null,
  };
}

export function loadFarmProgress(storage: FarmStorage, ownerId?: string, initialOpen = false): FarmProgressLoad {
  let raw: string | null;
  try { raw = storage.getItem(farmProgressStorageKey(ownerId)); }
  catch { return { state: { ...emptyFarmProgress(), active: initialOpen, started: initialOpen }, writable: false, warning: true }; }
  let preferenceRaw: string | null;
  try { preferenceRaw = storage.getItem(farmPreferenceStorageKey(ownerId)); }
  catch { return { ...initializeFarmProgress(raw, initialOpen), warning: true }; }
  return initializeFarmProgress(raw, initialOpen, preferenceRaw);
}

/** Keep a small display preference even when a future/invalid progress save is preserved. */
export function saveFarmProgress(storage: FarmStorage, ownerId: string | undefined, next: FarmProgress, writable = true): boolean {
  try {
    storage.setItem(farmPreferenceStorageKey(ownerId), JSON.stringify({ version: 1, active: next.active, started: next.started, collapsed: next.collapsed } satisfies FarmPreference));
    if (writable) storage.setItem(farmProgressStorageKey(ownerId), JSON.stringify(next));
    return true;
  } catch { return false; }
}
