const LEGACY_ROOM_VIEWS = new Map([
  ["warehouse", "workshop"], ["bank", "treasury"], ["office", "staff"], ["market", "market"],
  ["missions", "missions"], ["arena", "arena"], ["collection", "school"], ["shop", "shop"],
]);

/** Resume bookmarked rooms and activities in the 3D village. */
export function normalizeKqVillageLocation(search: string): string {
  const params = new URLSearchParams(search);
  const worlds = params.getAll("world");
  const legacyWorld = worlds.length > 1 || (worlds.length === 1 && worlds[0] !== "3d");
  if (!legacyWorld && !params.has("room")) return search;
  if (legacyWorld) params.set("world", "3d");
  const view = LEGACY_ROOM_VIEWS.get(params.get("room") ?? "");
  params.delete("room");
  if (!params.has("view") && view) params.set("view", view);
  const next = params.toString();
  return next ? `?${next}` : "";
}
