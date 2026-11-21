import type { KqWarehouseState } from "./kanab-quest-warehouse";

/** A draft for an empty, modern warehouse. Ownership and charges come from the normal quote. */
export function proposeFirstWarehousePlan(state: KqWarehouseState): KqWarehouseState | null {
  if (!state.floor || !state.airPlacements || !state.serviceZones || state.zones.length
    || state.serviceZones.length || state.airPlacements.length || state.partitions?.length
    || state.handlingPlacements?.length || state.stationPlacements?.length || state.preparedAreaM2) return null;
  return {
    ...state,
    zones: [{ id: "premiere-zone", name: "Première zone", x: 1, y: 2, width: 1, height: 1,
      active: true, lightingCode: "SIM-LIGHT-02", airCode: "SIM-AIR-01", optionCodes: ["SIM-SUBSTRATE-01"] }],
    serviceZones: [
      { id: "premier-sechage", name: "Filet de séchage", x: 3, y: 5, width: 1, height: 1, kind: "drying", deviceCode: "SJ-DRYIT90" },
      { id: "premier-stockage", name: "Premiers bocaux", x: 5, y: 5, width: 1, height: 1, kind: "storage", deviceCode: "LP-SUPER-1L" },
    ],
  };
}
