import { getKqWarehouseDimensions, getKqWarehousePartitionBounds, validateKqWarehouseState, type KqWarehouseState, type KqWarehouseRotation } from "./kanab-quest-warehouse";
export { KQ_WAREHOUSE_PARTITION_THICKNESS, getKqWarehousePartitionBounds } from "./kanab-quest-warehouse";
export type { KqWarehousePartition } from "./kanab-quest-warehouse";
/** Matches the first-person player's collision radius, including in thin wall gaps. */
export const KQ_WAREHOUSE_SPATIAL_PLAYER_RADIUS = 0.22;

/** A station's unturned front points down the plan (+Z). The saved angle is
 * measured around Three's +Y axis, opposite to SVG rotation on a top-down plan. */
const orientations = {
  0: { front: { x: 0, z: 1 }, yaw: 0, planDegrees: 0 },
  90: { front: { x: 1, z: 0 }, yaw: Math.PI / 2, planDegrees: -90 },
  180: { front: { x: 0, z: -1 }, yaw: Math.PI, planDegrees: -180 },
  270: { front: { x: -1, z: 0 }, yaw: 3 * Math.PI / 2, planDegrees: -270 },
} as const;

export function getKqWarehouseOrientation(rotation: KqWarehouseRotation = 0) {
  return orientations[rotation];
}

/** The saved footprint already includes its quarter turn. Recover the dimensions
 * at zero rotation before constructing or drawing the local fixture. */
export function getKqWarehouseLocalSize(width: number, depth: number, rotation: KqWarehouseRotation = 0) {
  return getKqWarehouseOrientation(rotation).front.x === 0 ? { width, depth } : { width: depth, depth: width };
}

export type WarehouseSpatialItem = {
  id: string;
  kind: "culture" | "drying" | "storage" | "partition";
  name: string;
  /** Metres, centred on the existing floor. Width/depth are the rotated footprint. */
  x: number;
  z: number;
  width: number;
  depth: number;
  rotation: KqWarehouseRotation;
  deviceCode?: string;
  href?: string;
  active?: boolean;
};
export type WarehouseSpatialLayout = {
  version: 1;
  width: number;
  depth: number;
  items: WarehouseSpatialItem[];
  /** Solid fittings with no work destination. The entry gate remains traversable. */
  obstacles?: Pick<WarehouseSpatialItem, "id" | "x" | "z" | "width" | "depth">[];
  entry: { x: number; z: number };
};

function solidStations(state: KqWarehouseState) {
  return [...(state.stationPlacements?.filter(station => station.code === "SIM-WATER-03") ?? []),
    ...(state.handlingPlacements ?? []).map(item => ({ id: item.code, x: item.x, y: item.y }))];
}

/** Pure projection: no conversion, purchases, synthetic zones or changed IDs. */
export function getKqWarehouseSpatialLayout(state: KqWarehouseState): WarehouseSpatialLayout {
  const { columns: width, rows: depth } = getKqWarehouseDimensions(state);
  const obstacles = solidStations(state).map(station => ({
    id: station.id, x: station.x + 0.5 - width / 2, z: station.y + 0.5 - depth / 2, width: 1, depth: 1,
  }));
  const position = (zone: KqWarehouseState["zones"][number] | NonNullable<KqWarehouseState["serviceZones"]>[number]) => ({
    id: zone.id, name: zone.name, x: zone.x + zone.width / 2 - width / 2,
    z: zone.y + zone.height / 2 - depth / 2, width: zone.width, depth: zone.height, rotation: zone.rotation ?? 0,
  });
  return { version: 1, width, depth, entry: { x: 0, z: depth / 2 + 0.7 },
    ...(obstacles.length ? { obstacles } : {}), items: [
    ...state.zones.map(zone => ({ ...position(zone), kind: "culture" as const, active: zone.active,
      href: `/arene/placard?view=workshop&zone=${encodeURIComponent(zone.id)}` })),
    ...(state.serviceZones ?? []).map(zone => ({ ...position(zone), kind: zone.kind, deviceCode: zone.deviceCode,
      href: `/arene/placard?view=workshop${zone.kind === "storage" ? "&section=storage" : ""}&zone=${encodeURIComponent(zone.id)}` })),
    ...(state.partitions ?? []).map(partition => ({ id: partition.id, kind: "partition" as const, name: "Paroi",
      ...getKqWarehousePartitionBounds(partition, { columns: width, rows: depth }), rotation: (partition.axis === "x" ? 0 : 90) as KqWarehouseRotation })),
  ] };
}

/** Half-metre node graph, including the external apron. Inflate solid footprints
 * by the player's radius, so thin centre-line walls divide cells correctly and
 * a real one-metre opening stays passable. Coordinates align with wall centres. */
export function getKqWarehouseInaccessibleZoneIds(state: KqWarehouseState): string[] {
  const { columns, rows } = getKqWarehouseDimensions(state);
  const zones = [...state.zones, ...(state.serviceZones ?? [])];
  const gridColumns = columns * 2 + 3, gridRows = rows * 2 + 3;
  const occupied = new Uint8Array(gridColumns * gridRows);
  const radius = KQ_WAREHOUSE_SPATIAL_PLAYER_RADIUS;
  const occupy = (x: number, y: number, width: number, height: number) => {
    const left = Math.max(0, Math.ceil((x - radius + 0.5) * 2)), right = Math.min(gridColumns - 1, Math.floor((x + width + radius + 0.5) * 2));
    const top = Math.max(0, Math.ceil((y - radius + 0.5) * 2)), bottom = Math.min(gridRows - 1, Math.floor((y + height + radius + 0.5) * 2));
    for (let row = top; row <= bottom; row++) for (let column = left; column <= right; column++) occupied[row * gridColumns + column] = 1;
  };
  for (const zone of zones) occupy(zone.x, zone.y, zone.width, zone.height);
  for (const station of solidStations(state)) occupy(station.x, station.y, 1, 1);
  for (const partition of state.partitions ?? []) {
    const bounds = getKqWarehousePartitionBounds(partition, { columns, rows });
    occupy(bounds.x + columns / 2 - bounds.width / 2, bounds.z + rows / 2 - bounds.depth / 2, bounds.width, bounds.depth);
  }
  const reachable = new Uint8Array(gridColumns * gridRows);
  const queue: number[] = [];
  const visit = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= gridColumns || y >= gridRows) return;
    const index = y * gridColumns + x;
    if (!occupied[index] && !reachable[index]) { reachable[index] = 1; queue.push(index); }
  };
  for (let x = 0; x < gridColumns; x++) { visit(x, 0); visit(x, gridRows - 1); }
  for (let y = 0; y < gridRows; y++) { visit(0, y); visit(gridColumns - 1, y); }
  for (let index = 0; index < queue.length; index++) {
    const x = queue[index] % gridColumns, y = Math.floor(queue[index] / gridColumns);
    visit(x - 1, y); visit(x + 1, y); visit(x, y - 1); visit(x, y + 1);
  }
  const free = (x: number, y: number) => {
    const column = Math.round((x + 0.5) * 2), row = Math.round((y + 0.5) * 2);
    return column >= 0 && row >= 0 && column < gridColumns && row < gridRows && !!reachable[row * gridColumns + column];
  };
  return zones.filter(zone => {
    for (let x = zone.x; x <= zone.x + zone.width; x += 0.5) if (free(x, zone.y - 0.5) || free(x, zone.y + zone.height + 0.5)) return false;
    for (let y = zone.y; y <= zone.y + zone.height; y += 0.5) if (free(zone.x - 0.5, y) || free(zone.x + zone.width + 0.5, y)) return false;
    return true;
  }).map(zone => zone.id);
}

/** Historical access defects are grandfathered; a rearrangement cannot add one. */
export function validateKqWarehouseSpatialTransition(previous: KqWarehouseState, next: KqWarehouseState): string[] {
  if (next.partitions === undefined && previous.partitions !== undefined) next = { ...next, partitions: previous.partitions };
  if (next.stationPlacements === undefined && previous.stationPlacements !== undefined) next = { ...next, stationPlacements: previous.stationPlacements };
  if (next.handlingPlacements === undefined && previous.handlingPlacements !== undefined) next = { ...next, handlingPlacements: previous.handlingPlacements };
  const errors = validateKqWarehouseState(next);
  if (errors.length) return errors;
  const alreadyBlocked = new Set(getKqWarehouseInaccessibleZoneIds(previous));
  const blocked = new Set(getKqWarehouseInaccessibleZoneIds(next).filter(id => !alreadyBlocked.has(id)));
  return [...next.zones, ...(next.serviceZones ?? [])].filter(zone => blocked.has(zone.id))
    .map(zone => `Garde un passage d’au moins 1 m vers « ${zone.name} ».`);
}

/** Moves only an existing footprint. The ordinary server quote remains authoritative. */
export function moveKqWarehouseSpatialItem(state: KqWarehouseState, id: string, placement: { x: number; z: number; rotation?: KqWarehouseRotation }): KqWarehouseState {
  const errors = validateKqWarehouseState(state);
  if (errors.length) throw new Error(errors.join(" "));
  if (!Number.isFinite(placement.x) || !Number.isFinite(placement.z)) throw new Error("Position d’aménagement invalide.");
  const zone = [...state.zones, ...(state.serviceZones ?? [])].find(item => item.id === id);
  if (!zone) throw new Error("Cette zone n’existe plus dans le plan.");
  const rotation = placement.rotation ?? zone.rotation ?? 0;
  if (![0, 90, 180, 270].includes(rotation)) throw new Error("L’orientation doit suivre un quart de tour.");
  const swap = Math.abs(rotation - (zone.rotation ?? 0)) % 180 === 90;
  const width = swap ? zone.height : zone.width, height = swap ? zone.width : zone.height;
  const dimensions = getKqWarehouseDimensions(state);
  const transform = { x: Math.round(placement.x + dimensions.columns / 2 - width / 2),
    y: Math.round(placement.z + dimensions.rows / 2 - height / 2), width, height, rotation };
  const next: KqWarehouseState = { ...state, spatial: { version: 1 },
    zones: state.zones.map(item => item.id === id ? { ...item, ...transform } : item),
    ...(state.serviceZones === undefined ? {} : { serviceZones: state.serviceZones.map(item => item.id === id ? { ...item, ...transform } : item) }),
  };
  const invalid = validateKqWarehouseSpatialTransition(state, next);
  if (invalid.length) throw new Error(invalid.join(" "));
  return next;
}
