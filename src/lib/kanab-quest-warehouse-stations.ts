import retailEquipment from "./kanab-quest-warehouse-retail-equipment.json";
import { doesKqWarehouseAirCrossWall, isKqWarehousePartitionCell } from "./kanab-quest-warehouse-air";
import type { KqWarehouseDimensions, KqWarehousePartition, KqWarehouseState } from "./kanab-quest-warehouse";

export const KQ_WAREHOUSE_STATIONS = {
  "SIM-WATER-03": { code: "SIM-WATER-03", name: "Centrale d’irrigation", priceCents: retailEquipment["SIM-WATER-03"].unitPriceCents, rangeM: 6, capacityM2: 20, yieldBonusPercent: 3, qualityBonus: 0, consumablesCentsPerM2: 240 },
  // Old run snapshots replay these local service values. New crops use the building-wide entrance protection at sowing.
  "SIM-HYGIENE-03": { code: "SIM-HYGIENE-03", name: "Sas d’entretien", priceCents: retailEquipment["SIM-HYGIENE-03"].unitPriceCents, rangeM: 8, capacityM2: 24, yieldBonusPercent: 0, qualityBonus: 3, consumablesCentsPerM2: 260 },
} as const;

type Cell = { x: number; y: number };
export type KqWarehouseStationCode = keyof typeof KQ_WAREHOUSE_STATIONS;
export type KqWarehouseStationPlacement = Cell & { id: string; code: KqWarehouseStationCode };
export type KqWarehouseStationZoneCoverage = { waterAreaM2: number; hygieneAreaM2: number };
export type KqWarehouseStationService = Record<string, KqWarehouseStationZoneCoverage>;
type StationPlan = Pick<KqWarehouseState, "zones" | "serviceZones" | "partitions" | "airPlacements" | "stationPlacements">;
const distance = (a: Cell, b: Cell) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export const isKqWarehouseStationCode = (code: string): code is KqWarehouseStationCode => Object.hasOwn(KQ_WAREHOUSE_STATIONS, code);
export const getKqWarehouseStationEntrance = (dimensions: KqWarehouseDimensions): Cell =>
  ({ x: Math.floor(dimensions.columns / 2), y: dimensions.rows - 1 });

/** Adopt the units already funded at their original unit price. */
export function adoptKqWarehouseStations(state: KqWarehouseState): KqWarehouseState {
  if (state.stationPlacements !== undefined) return state;
  return { ...state, stationPlacements: [], zones: state.zones.map(zone => zone.optionCodes?.some(isKqWarehouseStationCode)
    ? { ...zone, optionCodes: zone.optionCodes.filter(code => !isKqWarehouseStationCode(code)) } : zone) };
}

function canReach(placement: KqWarehouseStationPlacement, cell: Cell, partitions: KqWarehousePartition[]) {
  return distance(placement, cell) <= KQ_WAREHOUSE_STATIONS[placement.code].rangeM
    && !partitions.some(wall => doesKqWarehouseAirCrossWall(placement, cell, wall));
}

export function getKqWarehouseStationReach(placement: KqWarehouseStationPlacement, dimensions: KqWarehouseDimensions, partitions: KqWarehousePartition[] = []): Cell[] {
  return Array.from({ length: dimensions.columns * dimensions.rows }, (_, i) =>
    ({ x: i % dimensions.columns, y: Math.floor(i / dimensions.columns) }))
    .filter(cell => canReach(placement, cell, partitions));
}

export function validateKqWarehouseStationPlacements(value: unknown, dimensions: KqWarehouseDimensions, plan: StationPlan): string[] {
  if (!Array.isArray(value) || value.length > dimensions.columns * dimensions.rows) return ["Le plan des postes communs est invalide."];
  const errors = new Set<string>();
  const entrance = getKqWarehouseStationEntrance(dimensions);
  const zoneIds = new Set([...plan.zones, ...(plan.serviceZones ?? []), ...(plan.partitions ?? []), ...(plan.airPlacements ?? [])].map(item => item.id));
  const ids = new Set<string>();
  const cells = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !item.id.trim() || item.id.length > 80
      || typeof item.code !== "string" || !isKqWarehouseStationCode(item.code)
      || !Number.isInteger(item.x) || item.x < 0 || item.x >= dimensions.columns
      || !Number.isInteger(item.y) || item.y < 0 || item.y >= dimensions.rows) {
      errors.add("Chaque poste commun doit avoir un identifiant, un modèle et une case valides.");
      continue;
    }
    const key = `${item.x},${item.y}`;
    if (zoneIds.has(item.id) || ids.has(item.id)) errors.add("Chaque poste commun doit avoir un identifiant unique.");
    ids.add(item.id);
    if (cells.has(key) || [...plan.zones, ...(plan.serviceZones ?? [])].some(zone =>
      item.x >= zone.x && item.x < zone.x + zone.width && item.y >= zone.y && item.y < zone.y + zone.height)
      || plan.airPlacements?.some(air => !air.mount && air.x === item.x && air.y === item.y)
      || plan.partitions?.some(wall => isKqWarehousePartitionCell(item, wall))) {
      errors.add("Le poste commun doit occuper une case libre.");
    }
    cells.add(key);
    if (item.code === "SIM-HYGIENE-03" && distance(entrance, item) !== 0) errors.add("Le sas se place au seuil de la porte sud.");
  }
  if (plan.zones.some(zone => zone.optionCodes?.some(isKqWarehouseStationCode))) {
    errors.add("Les anciens modules doivent être remis en réserve avant de placer des postes communs.");
  }
  return [...errors];
}

export function getKqWarehouseStationCoverage(plan: StationPlan) {
  if (plan.stationPlacements === undefined) return undefined;
  const zones: KqWarehouseStationService = Object.fromEntries(plan.zones.map(zone => [zone.id, { waterAreaM2: 0, hygieneAreaM2: 0 }]));
  const cells: (Cell & { zoneId: string; code: KqWarehouseStationCode; placementId: string })[] = [];
  const assigned = { "SIM-WATER-03": new Set<string>(), "SIM-HYGIENE-03": new Set<string>() };
  const placements = [...plan.stationPlacements].sort((a, b) => a.y - b.y || a.x - b.x).map(placement => {
    const { capacityM2, rangeM } = KQ_WAREHOUSE_STATIONS[placement.code];
    const water = placement.code === "SIM-WATER-03";
    const prefix = water ? "SIM-WATER-" : "SIM-HYGIENE-";
    const occupied = assigned[placement.code];
    const eligible = plan.zones.filter(zone => !zone.optionCodes?.some(code => code.startsWith(prefix)))
      .flatMap(zone => Array.from({ length: zone.width * zone.height }, (_, i) => ({
        x: zone.x + i % zone.width, y: zone.y + Math.floor(i / zone.width), zoneId: zone.id, active: zone.active,
      })))
      .filter(cell => !occupied.has(`${cell.x},${cell.y}`) && canReach(placement, cell, plan.partitions ?? []))
      .sort((a, b) => Number(b.active) - Number(a.active) || distance(a, placement) - distance(b, placement) || a.y - b.y || a.x - b.x)
      .slice(0, capacityM2);
    for (const { x, y, zoneId } of eligible) {
      cells.push({ x, y, zoneId, code: placement.code, placementId: placement.id });
      occupied.add(`${x},${y}`);
      zones[zoneId][water ? "waterAreaM2" : "hygieneAreaM2"]++;
    }
    return { ...placement, capacityM2, rangeM, coveredAreaM2: eligible.length };
  });
  return { placements, cells, zones };
}

export function withKqWarehouseStationService<T extends StationPlan>(plan: T) {
  const coverage = getKqWarehouseStationCoverage(plan);
  return coverage ? { ...plan, stationService: coverage.zones } : plan;
}
