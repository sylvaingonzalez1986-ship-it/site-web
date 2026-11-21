import retailEquipment from "./kanab-quest-warehouse-retail-equipment.json";
import type { KqWarehouseCondition } from "./kanab-quest-warehouse-condition";
import type { KqWarehouseState } from "./kanab-quest-warehouse";
import { isKqWarehousePartitionCell } from "./kanab-quest-warehouse-air";

export const KQ_WAREHOUSE_HANDLING_CART = "SIM-LOGISTICS-02";
export const KQ_WAREHOUSE_HANDLING_CART_PRICE_CENTS = retailEquipment[KQ_WAREHOUSE_HANDLING_CART].unitPriceCents;
export const KQ_WAREHOUSE_HANDLING_CART_SAVING = .25;

export const KQ_WAREHOUSE_HANDLING = {
  "SIM-LOGISTICS-01": { name: "Desserte mobile", operation: "Trim manuel et à la machine", saving: .10, priceCents: retailEquipment["SIM-LOGISTICS-01"].unitPriceCents },
  [KQ_WAREHOUSE_HANDLING_CART]: { name: "Chariot de manutention", operation: "Chargement du lyophilisateur", saving: KQ_WAREHOUSE_HANDLING_CART_SAVING, priceCents: KQ_WAREHOUSE_HANDLING_CART_PRICE_CENTS },
  "SIM-LOGISTICS-03": { name: "Table de trim", operation: "Trim manuel", saving: .20, priceCents: retailEquipment["SIM-LOGISTICS-03"].unitPriceCents },
} as const;

export type KqWarehouseHandlingCode = keyof typeof KQ_WAREHOUSE_HANDLING;
export type KqWarehouseHandlingPlacement = { code: KqWarehouseHandlingCode; x: number; y: number };
export type KqWarehouseHandling = Partial<Record<KqWarehouseHandlingCode, number>>;

export function isKqWarehouseHandlingCode(code: string): code is KqWarehouseHandlingCode {
  return Object.hasOwn(KQ_WAREHOUSE_HANDLING, code);
}

export function hasKqWarehouseHandling(state: KqWarehouseState | undefined, code: KqWarehouseHandlingCode) {
  return !!state?.optionInventory?.some(item => item.code === code && item.quantity === 1)
    && !state.zones.some(zone => zone.optionCodes?.includes(code));
}

export function placeKqWarehouseHandling(state: KqWarehouseState, placement: KqWarehouseHandlingPlacement): KqWarehouseState {
  const placements = state.handlingPlacements ?? [];
  return { ...state,
    handlingPlacements: [...placements.filter(item => item.code !== placement.code), placement],
    optionInventory: hasKqWarehouseHandling(state, placement.code) ? state.optionInventory
      : [...(state.optionInventory ?? []).filter(item => item.code !== placement.code), { code: placement.code, quantity: 1 }],
  };
}

export function validateKqWarehouseHandlingPlacements(state: KqWarehouseState, dimensions: { columns: number; rows: number }): string[] {
  const placements = state.handlingPlacements;
  if (placements === undefined) return [];
  if (!Array.isArray(placements) || placements.length > 3) return ["Emplacements de manutention invalides."];
  const codes = new Set<string>();
  const cells = new Set<string>();
  for (const item of placements) {
    if (!item || !isKqWarehouseHandlingCode(item.code) || codes.has(item.code)
      || !Number.isInteger(item.x) || !Number.isInteger(item.y)
      || item.x < 0 || item.y < 0 || item.x >= dimensions.columns || item.y >= dimensions.rows) {
      return ["Choisis une seule case du plan pour chaque équipement de manutention."];
    }
    if (!hasKqWarehouseHandling(state, item.code)) return ["L’équipement à placer doit figurer dans l’inventaire de l’entrepôt."];
    const key = item.x + "," + item.y;
    if (cells.has(key) || item.x === Math.floor(dimensions.columns / 2) && item.y === dimensions.rows - 1
      || [...state.zones, ...(state.serviceZones ?? [])].some(zone => item.x >= zone.x && item.x < zone.x + zone.width && item.y >= zone.y && item.y < zone.y + zone.height)
      || state.stationPlacements?.some(station => station.x === item.x && station.y === item.y)
      || state.airPlacements?.some(fan => !fan.mount && fan.x === item.x && fan.y === item.y)
      || state.partitions?.some(wall => isKqWarehousePartitionCell(item, wall))) {
      return ["Choisis une case libre pour la manutention et laisse l’entrée dégagée."];
    }
    cells.add(key);
    codes.add(item.code);
  }
  return [];
}

export function getKqWarehouseHandling(state: KqWarehouseState | undefined, condition?: KqWarehouseCondition | null): KqWarehouseHandling {
  const handling: KqWarehouseHandling = {};
  for (const asset of condition?.assets ?? []) {
    if (asset.kind === "option" && asset.zoneId === null && asset.quantity === 1
      && isKqWarehouseHandlingCode(asset.code) && hasKqWarehouseHandling(state, asset.code)
      && state?.handlingPlacements?.some(item => item.code === asset.code)) {
      handling[asset.code] = asset.wearPercent;
    }
  }
  return handling;
}

export function getKqWarehouseHandlingSaving(code: KqWarehouseHandlingCode, wear: number | undefined) {
  return wear !== undefined && Number.isFinite(wear)
    ? KQ_WAREHOUSE_HANDLING[code].saving * (1 - Math.max(0, Math.min(100, wear)) / 100) : 0;
}

export function getKqTrimTimeFactor(mode: "manual" | "machine", handling?: KqWarehouseHandling) {
  const trolley = getKqWarehouseHandlingSaving("SIM-LOGISTICS-01", handling?.["SIM-LOGISTICS-01"]);
  const table = mode === "manual" ? getKqWarehouseHandlingSaving("SIM-LOGISTICS-03", handling?.["SIM-LOGISTICS-03"]) : 0;
  return (1 - trolley) * (1 - table);
}
