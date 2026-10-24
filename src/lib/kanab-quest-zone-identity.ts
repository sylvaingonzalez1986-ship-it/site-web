import type { KqWarehouseState } from "./kanab-quest-warehouse";

export type KqZoneIdentity = {
  number: string;
  label: string;
  color: string;
  tint: string;
};

// The same order drives the plan, its controls and culture preparation.
// These accents are backgrounds; labels keep the game's dark ink for contrast.
const ZONE_COLORS = [
  { color: "#55BBA8", tint: "#D8EFE7" },
  { color: "#EAC34C", tint: "#F7ECC5" },
  { color: "var(--game-surface-warm, #ffb05c)", tint: "#FFF1D6" },
  { color: "#82B9D7", tint: "#DEEDF4" },
  { color: "#B7A2D9", tint: "#ECE5F5" },
  { color: "#DF96AF", tint: "#F6DFE7" },
  { color: "#AAC271", tint: "#E8EFD5" },
  { color: "#91AAA4", tint: "#E0EAE6" },
] as const;

export function getKqZoneIdentity(
  state: Pick<KqWarehouseState, "zones" | "serviceZones">,
  zoneId: string,
): KqZoneIdentity | null {
  const index = [...state.zones, ...(state.serviceZones ?? [])].findIndex(zone => zone.id === zoneId);
  if (index < 0) return null;
  const number = String(index + 1).padStart(2, "0");
  return { number, label: `Zone ${number}`, ...ZONE_COLORS[index % ZONE_COLORS.length] };
}
