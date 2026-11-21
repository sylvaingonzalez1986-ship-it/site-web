import { getKqWarehouseDevice, getKqWarehouseDeviceQualityBonus } from "./kanab-quest-warehouse-catalog";
import type { KqWarehouseDimensions, KqWarehousePartition, KqWarehouseState } from "./kanab-quest-warehouse";

export type KqWarehouseAirFace = "north" | "east" | "south" | "west";
export type KqWarehouseAirMount = { kind: "wall"; face: KqWarehouseAirFace; partitionId?: string };
export type KqWarehouseAirPlacement = { id: string; code: string; x: number; y: number; mount?: KqWarehouseAirMount };
export type KqWarehouseAirZoneCoverage = {
  areaM2: number;
  coveredAreaM2: number;
  coverageRatio: number;
  qualityBonus: number;
  powerWatts: number;
};
export type KqWarehouseAirService = Record<string, { coveredAreaM2: number; qualityPoints: number; powerMilliWatts: number }>;
type Cell = { x: number; y: number };
type AirCell = Cell & { zoneId: string; placementId: string | null; code: string | null };
type AirPlacementCoverage = KqWarehouseAirPlacement & { coveredAreaM2: number; capacityM2: number; rangeM: number; powerWatts: number };
type AirPlan = Pick<KqWarehouseState, "zones" | "partitions" | "airPlacements">;

const key = ({ x, y }: Cell) => `${x},${y}`;
const distance = (a: Cell, b: Cell) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const natural = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const withinFloor = (cell: Cell, dimensions: KqWarehouseDimensions) =>
  natural(cell.x) && natural(cell.y) && cell.x < dimensions.columns && cell.y < dimensions.rows;
const FACE_STEP: Record<KqWarehouseAirFace, Cell> = {
  north: { x: 0, y: -1 }, east: { x: 1, y: 0 }, south: { x: 0, y: 1 }, west: { x: -1, y: 0 },
};
const getDevice = (code: string) => {
  const device = getKqWarehouseDevice(code);
  return device?.kind === "air" && device.gameCapacity?.unit === "m2" ? device : undefined;
};
export const getKqWarehouseAirRange = (capacity: number) => Math.ceil(Math.sqrt(capacity));

export function isKqWarehousePartitionCell(cell: Cell, wall: KqWarehousePartition) {
  return wall.axis === "x"
    ? cell.y === wall.y && cell.x >= wall.x && cell.x < wall.x + wall.length
    : cell.x === wall.x && cell.y >= wall.y && cell.y < wall.y + wall.length;
}

export function getKqWarehouseAirMounts(cell: Cell, dimensions: KqWarehouseDimensions, partitions: KqWarehousePartition[] = []): KqWarehouseAirMount[] {
  if (!withinFloor(cell, dimensions)) return [];
  const hosts = partitions.filter(wall => isKqWarehousePartitionCell(cell, wall));
  if (hosts.length > 1) return [];
  const host = hosts[0];
  const faces: KqWarehouseAirFace[] = [];
  if (host) {
    faces.push(...(host.axis === "x" ? ["north", "south"] as const : ["east", "west"] as const));
  } else {
    if (cell.y === dimensions.rows - 1) faces.push("north");
    if (cell.x === 0) faces.push("east");
    if (cell.y === 0) faces.push("south");
    if (cell.x === dimensions.columns - 1) faces.push("west");
  }
  return faces.filter(face => {
    if (!host) return true;
    const step = FACE_STEP[face];
    const next = { x: cell.x + step.x, y: cell.y + step.y };
    return withinFloor(next, dimensions) && !partitions.some(wall => isKqWarehousePartitionCell(next, wall));
  }).map(face => ({ kind: "wall", face, ...(host ? { partitionId: host.id } : {}) }));
}

function hasValidMount(placement: KqWarehouseAirPlacement, dimensions: KqWarehouseDimensions, partitions: KqWarehousePartition[]) {
  if (placement.mount === undefined) return !partitions.some(wall => isKqWarehousePartitionCell(placement, wall));
  const mount = placement.mount;
  return !!mount && mount.kind === "wall" && getKqWarehouseAirMounts(placement, dimensions, partitions)
    .some(candidate => candidate.face === mount.face && candidate.partitionId === mount.partitionId);
}

export function validateKqWarehouseAirPlacements(value: unknown, dimensions: KqWarehouseDimensions, partitions: KqWarehousePartition[] = []): string[] {
  if (!Array.isArray(value) || value.length > dimensions.columns * dimensions.rows) return ["Le plan de ventilation est invalide."];
  const errors = new Set<string>();
  const ids = new Set<string>();
  const occupied = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !item.id.trim() || item.id.length > 80
      || typeof item.code !== "string" || !getDevice(item.code) || !natural(item.x) || !natural(item.y)) {
      errors.add("Chaque extracteur doit avoir un identifiant, un modèle et une case valides.");
      continue;
    }
    if (ids.has(item.id)) errors.add("Chaque extracteur doit avoir un identifiant unique.");
    ids.add(item.id);
    if (!withinFloor(item, dimensions)) errors.add("Les extracteurs doivent rester dans les limites de l’entrepôt.");
    if (occupied.has(key(item))) errors.add("Une case ne peut recevoir qu’un extracteur.");
    occupied.add(key(item));
    if (!hasValidMount(item, dimensions, partitions)) errors.add(item.mount === undefined
      ? "Un extracteur au sol doit être posé hors des parois."
      : "Le support ou la face d’aspiration de l’extracteur mural est invalide.");
  }
  return [...errors];
}

/** Tests the line between cell centres against the physical centre line of a partition. */
export function doesKqWarehouseAirCrossWall(from: Cell, to: Cell, wall: KqWarehousePartition) {
  const horizontal = wall.axis === "x";
  const a = horizontal ? from.y : from.x;
  const b = horizontal ? to.y : to.x;
  const axis = horizontal ? wall.y : wall.x;
  const start = horizontal ? from.x : from.y;
  const end = horizontal ? to.x : to.y;
  const wallStart = horizontal ? wall.x : wall.y;
  if (a === b) return a === axis && Math.min(start, end) + 0.5 <= wallStart + wall.length
    && Math.max(start, end) + 0.5 >= wallStart;
  if ((a < axis && b < axis) || (a > axis && b > axis)) return false;
  const intersection = start + 0.5 + (end - start) * (axis - a) / (b - a);
  return intersection >= wallStart && intersection <= wallStart + wall.length;
}

function reaches(placement: KqWarehouseAirPlacement, cell: Cell, range: number, partitions: KqWarehousePartition[]) {
  if (distance(cell, placement) > range) return false;
  const mount = placement.mount;
  if (mount) {
    const face = FACE_STEP[mount.face];
    if (!face) return false;
    const depth = (cell.x - placement.x) * face.x + (cell.y - placement.y) * face.y;
    if (depth < (mount.partitionId === undefined ? 0 : 1)) return false;
  }
  return !partitions.some(wall => wall.id !== mount?.partitionId && doesKqWarehouseAirCrossWall(placement, cell, wall));
}

/** The reachable floor before assigning the device capacity to individual culture cells. */
export function getKqWarehouseAirReach(placement: KqWarehouseAirPlacement, dimensions: KqWarehouseDimensions, partitions: KqWarehousePartition[] = []): Cell[] {
  const capacity = getDevice(placement.code)?.gameCapacity?.value;
  if (!capacity || !withinFloor(placement, dimensions) || !hasValidMount(placement, dimensions, partitions)) return [];
  const range = getKqWarehouseAirRange(capacity);
  const cells: Cell[] = [];
  for (let y = Math.max(0, placement.y - range); y <= Math.min(dimensions.rows - 1, placement.y + range); y++) {
    for (let x = Math.max(0, placement.x - range); x <= Math.min(dimensions.columns - 1, placement.x + range); x++) {
      const cell = { x, y };
      if (!partitions.some(wall => isKqWarehousePartitionCell(cell, wall)) && reaches(placement, cell, range, partitions)) cells.push(cell);
    }
  }
  return cells;
}

function getCells(zone: KqWarehouseState["zones"][number]): AirCell[] {
  return Array.from({ length: zone.width * zone.height }, (_, i) => ({
    x: zone.x + i % zone.width, y: zone.y + Math.floor(i / zone.width),
    zoneId: zone.id, placementId: null, code: null,
  }));
}

/** Convert each historical device requirement into placements without adding devices. */
export function getKqWarehouseAirPlacements(plan: AirPlan): KqWarehouseAirPlacement[] {
  if (plan.airPlacements !== undefined) return plan.airPlacements.map(item => ({ ...item, ...(item.mount ? { mount: { ...item.mount } } : {}) }));
  return plan.zones.flatMap((zone, index) => {
    const device = getDevice(zone.airCode);
    if (!device?.gameCapacity) return [];
    const capacity = device.gameCapacity.value;
    const range = getKqWarehouseAirRange(capacity);
    const cells = getCells(zone);
    const candidates = [...cells];
    const uncovered = new Set(cells);
    const placements: KqWarehouseAirPlacement[] = [];
    for (let unit = 0; unit < Math.ceil(cells.length / capacity); unit++) {
      let bestIndex = 0;
      let bestCells: AirCell[] = [];
      for (const [candidateIndex, candidate] of candidates.entries()) {
        const nearby = [...uncovered].filter(cell => distance(cell, candidate) <= range);
        if (nearby.length > bestCells.length) {
          bestIndex = candidateIndex;
          bestCells = nearby;
          if (nearby.length >= capacity) break;
        }
      }
      const [{ x, y }] = candidates.splice(bestIndex, 1);
      placements.push({ id: `air-legacy-${index}-${unit}`, code: device.code, x, y });
      bestCells.sort((a, b) => distance(a, { x, y }) - distance(b, { x, y }) || a.y - b.y || a.x - b.x);
      for (const cell of bestCells.slice(0, capacity)) uncovered.delete(cell);
    }
    return placements;
  });
}

export function getKqWarehouseAirCoverage(plan: AirPlan) {
  if (plan.airPlacements === undefined) return undefined;
  const partitions = plan.partitions ?? [];
  const cells = plan.zones.flatMap(getCells);
  const active = new Set(plan.zones.filter(zone => zone.active).map(zone => zone.id));
  const service: KqWarehouseAirService = Object.fromEntries(plan.zones.map(zone => [
    zone.id, { coveredAreaM2: 0, qualityPoints: 0, powerMilliWatts: 0 },
  ]));
  const placements: AirPlacementCoverage[] = [];
  const ordered = [...plan.airPlacements].sort((a, b) => getKqWarehouseDeviceQualityBonus(b.code) - getKqWarehouseDeviceQualityBonus(a.code)
    || a.y - b.y || a.x - b.x);
  for (const placement of ordered) {
    const device = getDevice(placement.code);
    if (!device?.gameCapacity) continue;
    const capacityM2 = device.gameCapacity.value;
    const rangeM = getKqWarehouseAirRange(capacityM2);
    const quality = getKqWarehouseDeviceQualityBonus(placement.code);
    const served = cells.filter(cell => cell.placementId === null && reaches(placement, cell, rangeM, partitions))
      .sort((a, b) => Number(active.has(b.zoneId)) - Number(active.has(a.zoneId))
        || distance(a, placement) - distance(b, placement) || a.y - b.y || a.x - b.x)
      .slice(0, capacityM2);
    const activeCells = served.filter(cell => active.has(cell.zoneId));
    const milliWatts = device.watts * 1000;
    const share = activeCells.length ? Math.floor(milliWatts / activeCells.length) : 0;
    const remainder = activeCells.length ? milliWatts % activeCells.length : 0;
    for (const [index, cell] of served.entries()) {
      cell.placementId = placement.id;
      cell.code = placement.code;
      const zone = service[cell.zoneId];
      zone.coveredAreaM2++;
      zone.qualityPoints += quality;
      if (index < activeCells.length) zone.powerMilliWatts += share + Number(index < remainder);
    }
    placements.push({ ...placement, capacityM2, rangeM, coveredAreaM2: served.length, powerWatts: activeCells.length ? device.watts : 0 });
  }
  const zones: Record<string, KqWarehouseAirZoneCoverage> = Object.fromEntries(plan.zones.map(zone => {
    const areaM2 = zone.width * zone.height;
    const { coveredAreaM2, qualityPoints, powerMilliWatts } = service[zone.id];
    return [zone.id, { areaM2, coveredAreaM2, coverageRatio: coveredAreaM2 / areaM2,
      qualityBonus: qualityPoints / areaM2, powerWatts: powerMilliWatts / 1000 }];
  }));
  return { cells, zones, placements, service };
}

/** Persist the projection calculated by the server for transaction and run validation. */
export function withKqWarehouseAirService(state: KqWarehouseState): KqWarehouseState {
  const coverage = getKqWarehouseAirCoverage(state);
  if (coverage) return { ...state, airService: coverage.service };
  if (!Object.hasOwn(state, "airService")) return state;
  const historical = { ...state };
  delete historical.airService;
  return historical;
}
