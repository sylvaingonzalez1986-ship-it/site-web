const BUILDING_VIEWS = {
  bank: "treasury", office: "staff", market: "market", missions: "missions", arena: "arena", shop: "shop",
} as const;

export type IsometricBuilding = keyof typeof BUILDING_VIEWS;

export function isIsometricBuilding(id: string | null): id is IsometricBuilding {
  return id !== null && Object.hasOwn(BUILDING_VIEWS, id);
}

export function buildingForActivity(view: string): IsometricBuilding | undefined {
  if (view === "social") return "market";
  return (Object.keys(BUILDING_VIEWS) as IsometricBuilding[]).find(id => BUILDING_VIEWS[id] === view);
}

export function buildingRoomHref(id: IsometricBuilding) {
  return `/arene/placard?view=hub&room=${id}`;
}

/** Resume bookmarked rooms and activities in the 3D village. */
export function normalizeKqVillageLocation(search: string): string {
  const params = new URLSearchParams(search);
  const worlds = params.getAll("world");
  const legacyWorld = worlds.length > 1 || (worlds.length === 1 && worlds[0] !== "3d");
  if (!legacyWorld && !params.has("room")) return search;
  if (legacyWorld) params.set("world", "3d");
  const room = params.get("room");
  if (params.get("view") === "hub" && isIsometricBuilding(room)) {
    if (!legacyWorld && params.getAll("room").length === 1) return search;
    params.set("room", room);
  } else {
    const view = isIsometricBuilding(room) ? BUILDING_VIEWS[room] : room === "warehouse" ? "workshop" : room === "collection" ? "school" : undefined;
    params.delete("room");
    if (!params.has("view") && view) params.set("view", view);
  }
  const next = params.toString();
  return next ? `?${next}` : "";
}
