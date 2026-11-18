import type { VillageBuildingKind } from "./village-buildings";

const ROOMS = ["warehouse", "bank", "office", "market", "missions", "arena", "collection", "shop"] as const;
export function parseInteriorId(value: string | null): VillageBuildingKind | null {
  return ROOMS.find(id => id === value) ?? null;
}
export function interiorForView(view: string | null): VillageBuildingKind | null {
  return ({ game: "warehouse", workshop: "warehouse", harvests: "warehouse", treasury: "bank", staff: "office", market: "market", social: "market", missions: "missions", arena: "arena", school: "collection", shop: "shop" } as Record<string, VillageBuildingKind>)[view ?? ""] ?? null;
}
