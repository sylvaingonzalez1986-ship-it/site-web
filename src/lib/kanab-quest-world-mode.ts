export type KqWorldMode = "2d" | "3d";
type WorldModeStorage = Pick<Storage, "getItem" | "setItem">;

const remembered = new Map<string, KqWorldMode>();
const unsaved = new Set<string>();
export const kqWorldModeStorageKey = (ownerId: string) => `kq:world-mode:v1:${ownerId}`;

export function parseKqWorldMode(value: unknown): KqWorldMode | undefined {
  return value === "2d" || value === "3d" ? value : undefined;
}

export function requestedKqWorldMode(search: string): KqWorldMode | undefined {
  const values = new URLSearchParams(search).getAll("world");
  return values.length === 1 ? parseKqWorldMode(values[0]) : undefined;
}

const LEGACY_ROOM_VIEWS = new Map([
  ["warehouse", "workshop"], ["bank", "treasury"], ["office", "staff"], ["market", "market"],
  ["missions", "missions"], ["arena", "arena"], ["collection", "school"], ["shop", "shop"],
]);

/** Interior exploration is shelved; old bookmarks resume the ordinary activity. */
export function normalizeKqVillageLocation(search: string): string {
  const params = new URLSearchParams(search);
  if (!params.has("room")) return search;
  const view = LEGACY_ROOM_VIEWS.get(params.get("room") ?? "");
  params.delete("room");
  if (!params.has("view") && view) params.set("view", view);
  const next = params.toString();
  return next ? `?${next}` : "";
}

export function readKqWorldMode(ownerId: string | undefined, storage: WorldModeStorage | null): KqWorldMode {
  if (!ownerId) return "2d";
  if (unsaved.has(ownerId)) return remembered.get(ownerId) ?? "2d";
  try {
    if (storage) {
      const mode = parseKqWorldMode(storage.getItem(kqWorldModeStorageKey(ownerId)));
      if (mode) remembered.set(ownerId, mode);
      else remembered.delete(ownerId);
      return mode ?? "2d";
    }
  } catch { /* Keep the current visit usable when storage is blocked. */ }
  return remembered.get(ownerId) ?? "2d";
}

export function rememberKqWorldMode(ownerId: string | undefined, mode: KqWorldMode, storage: WorldModeStorage | null) {
  if (!ownerId) return;
  remembered.set(ownerId, mode);
  unsaved.add(ownerId);
  try {
    if (storage) {
      storage.setItem(kqWorldModeStorageKey(ownerId), mode);
      unsaved.delete(ownerId);
    }
  } catch { /* The selection remains in memory for this account and visit. */ }
}

/** A change in another tab supersedes an earlier in-memory fallback. */
export function refreshKqWorldMode(ownerId: string | undefined) {
  if (!ownerId) return;
  remembered.delete(ownerId);
  unsaved.delete(ownerId);
}
