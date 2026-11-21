import { doesKqWarehouseAirCrossWall, isKqWarehousePartitionCell } from "./kanab-quest-warehouse-air";
import { getKqWarehouseDimensions, isKqWarehouseZoneOperational, type KqWarehouseState } from "./kanab-quest-warehouse";

export const KQ_CAMERA_SPEC = { angle: 90, rangeM: 6, maximum: 12 } as const;
export const KQ_WAREHOUSE_CAMERA_BEARINGS = [
  { name: "Nord", arrow: "↑", x: 0, y: -1 }, { name: "Nord-est", arrow: "↗", x: 1, y: -1 },
  { name: "Est", arrow: "→", x: 1, y: 0 }, { name: "Sud-est", arrow: "↘", x: 1, y: 1 },
  { name: "Sud", arrow: "↓", x: 0, y: 1 }, { name: "Sud-ouest", arrow: "↙", x: -1, y: 1 },
  { name: "Ouest", arrow: "←", x: -1, y: 0 }, { name: "Nord-ouest", arrow: "↖", x: -1, y: -1 },
] as const;

type Cell = { x: number; y: number };
export type KqWarehouseCameraPlacement = Cell & { bearing: number };
export type KqWarehouseCamera = { id: string; placement: KqWarehouseCameraPlacement | null };
export type KqWarehouseSecuritySnapshot = {
  layout: KqWarehouseState | null;
  layoutRevision: number;
  revision: number;
  cashCents: number;
  prices: { cameraCents: number; alarmCents: number; monitoringCents: number };
  cameras: KqWarehouseCamera[];
  alarm: "none" | "owned" | "installed";
  monitoring: { status: "none" | "active" | "suspended" | "cancelled"; enabled: boolean; paidUntil: string | null };
  receipt?: { chargedCents: number; replayed: boolean };
};
export type KqWarehouseSecurityAction =
  | { action: "buy-camera" | "buy-alarm" | "buy-install-alarm" | "install-alarm" | "subscribe" | "pause" | "cancel" }
  | { action: "buy-place-camera"; placement: KqWarehouseCameraPlacement }
  | { action: "place-camera"; cameraId: string; placement: KqWarehouseCameraPlacement }
  | { action: "stow-camera"; cameraId: string };
export type KqWarehouseSecurityDecision = {
  alarm: boolean;
  monitored: boolean;
  filmed: Record<string, number>;
};

export const kqSecurityCellKey = ({ x, y }: Cell) => `${x},${y}`;
const contains = (zone: { x: number; y: number; width: number; height: number }, cell: Cell) =>
  cell.x >= zone.x && cell.x < zone.x + zone.width && cell.y >= zone.y && cell.y < zone.y + zone.height;

export function getKqWarehouseSecurityObstacles(layout: KqWarehouseState, cell: Cell) {
  if (layout.partitions?.some(wall => isKqWarehousePartitionCell(cell, wall))) return "Cloison";
  if (layout.stationPlacements?.some(station => station.code === "SIM-WATER-03" && station.x === cell.x && station.y === cell.y)) return "Centrale d’irrigation";
  return null;
}

function crossesStation(from: Cell, to: Cell, station: Cell) {
  // Clip the sight line against the same one-metre footprint as the interior.
  let start = 0, end = 1;
  for (const axis of ["x", "y"] as const) {
    const step = to[axis] - from[axis];
    const distance = station[axis] - from[axis];
    if (step === 0) {
      if (Math.abs(distance) > 0.5) return false;
      continue;
    }
    const low = (distance - 0.5) / step;
    const high = (distance + 0.5) / step;
    start = Math.max(start, Math.min(low, high));
    end = Math.min(end, Math.max(low, high));
    if (start > end) return false;
  }
  return true;
}

export function getKqWarehouseCameraCoverage(layout: KqWarehouseState, camera: KqWarehouseCameraPlacement): Set<string> {
  const visible = new Set<string>();
  const { columns, rows } = getKqWarehouseDimensions(layout);
  const bearing = KQ_WAREHOUSE_CAMERA_BEARINGS[camera.bearing];
  if (!bearing || !Number.isInteger(camera.x) || !Number.isInteger(camera.y) || camera.x < 0 || camera.x >= columns
    || camera.y < 0 || camera.y >= rows || getKqWarehouseSecurityObstacles(layout, camera)) return visible;
  const range = KQ_CAMERA_SPEC.rangeM;
  const stations = layout.stationPlacements?.filter(station => station.code === "SIM-WATER-03") ?? [];
  for (let y = Math.max(0, camera.y - range); y <= Math.min(rows - 1, camera.y + range); y++) {
    for (let x = Math.max(0, camera.x - range); x <= Math.min(columns - 1, camera.x + range); x++) {
      const dx = x - camera.x, dy = y - camera.y;
      const radius2 = dx * dx + dy * dy;
      const dot = bearing.x * dx + bearing.y * dy;
      const direction2 = bearing.x * bearing.x + bearing.y * bearing.y;
      const cell = { x, y };
      // A 90° field gives cos²(45°) = 1/2, including both boundary rays.
      if (radius2 > range * range || dot < 0 || 2 * dot * dot < direction2 * radius2
        || layout.partitions?.some(wall => isKqWarehousePartitionCell(cell, wall) || doesKqWarehouseAirCrossWall(camera, cell, wall))
        || stations.some(station => crossesStation(camera, cell, station))) continue;
      visible.add(kqSecurityCellKey(cell));
    }
  }
  return visible;
}

export function getKqWarehouseSecurityCoverage(layout: KqWarehouseState, cameras: readonly KqWarehouseCamera[]) {
  const visible = new Set<string>();
  for (const camera of cameras) {
    if (camera.placement) for (const key of getKqWarehouseCameraCoverage(layout, camera.placement)) visible.add(key);
  }
  const zones = layout.zones.map(zone => {
    const area = zone.width * zone.height;
    const covered = [...visible].reduce((total, key) => {
      const [x, y] = key.split(",").map(Number);
      return total + Number(contains(zone, { x, y }));
    }, 0);
    return { id: zone.id, name: zone.name, active: isKqWarehouseZoneOperational(zone), covered, area };
  });
  return { visible, zones };
}

export function isKqWarehouseSecurityDecision(value: unknown): value is KqWarehouseSecurityDecision {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const decision = value as Record<string, unknown>;
  if (Object.keys(decision).length !== 3 || typeof decision.alarm !== "boolean" || typeof decision.monitored !== "boolean"
    || decision.monitored && !decision.alarm || !decision.filmed || typeof decision.filmed !== "object" || Array.isArray(decision.filmed)) return false;
  const rates = Object.values(decision.filmed);
  return rates.length <= 52 && rates.every(rate => Number.isInteger(rate) && rate >= 0 && rate <= 100);
}

export function getKqWarehouseSecurityReduction(decision: KqWarehouseSecurityDecision, filmedPercent: number) {
  return filmedPercent / 2 + (decision.alarm ? 25 : 0) + (decision.monitored ? 25 : 0);
}

export function getKqWarehouseProtectedTheftLoss(decision: KqWarehouseSecurityDecision,
  zones: readonly KqWarehouseState["zones"][number][], rawLoss: number) {
  let loss = 0, area = 0;
  for (const zone of zones.filter(isKqWarehouseZoneOperational)) {
    const size = zone.width * zone.height;
    const filmed = Object.hasOwn(decision.filmed, zone.id) ? decision.filmed[zone.id] : 0;
    area += size;
    loss += size * rawLoss * (1 - getKqWarehouseSecurityReduction(decision, filmed) / 100);
  }
  return area ? Math.round(loss / area) : rawLoss;
}
