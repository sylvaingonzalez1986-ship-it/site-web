import { getKqWarehouseOrientation, KQ_WAREHOUSE_SPATIAL_PLAYER_RADIUS, type WarehouseSpatialItem, type WarehouseSpatialLayout } from "./kanab-quest-warehouse-spatial";
import type { KqCareSector } from "./kanab-quest-care-spatial";

export type GrowPoint = { x: number; z: number };
type WalkBounds = { left: number; right: number; back: number; front: number };
const clearance = KQ_WAREHOUSE_SPATIAL_PLAYER_RADIUS;
const distance = (a: GrowPoint, b: GrowPoint) => Math.hypot(a.x - b.x, a.z - b.z);

/** Saved width and depth already include the station's rotation. */
export function growRoomSectorCenter(item: WarehouseSpatialItem | undefined, sector: KqCareSector): GrowPoint | null {
  if (item?.id !== sector.zoneId || item.kind !== "culture" || !Number.isInteger(sector.x) || !Number.isInteger(sector.y)
    || sector.x < 0 || sector.y < 0 || sector.x >= item.width || sector.y >= item.depth) return null;
  return { x: item.x - item.width / 2 + sector.x + .5, z: item.z - item.depth / 2 + sector.y + .5 };
}

/** Swept centre vs an expanded rectangle, including thin walls between grid nodes. */
function crosses(a: GrowPoint, b: GrowPoint, box: WalkBounds) {
  let enter = 0, exit = 1;
  for (const [start, delta, min, max] of [[a.x, b.x - a.x, box.left, box.right], [a.z, b.z - a.z, box.back, box.front]]) {
    if (Math.abs(delta) < 1e-8) {
      if (start < min || start > max) return false;
    } else {
      const lo = (min - start) / delta, hi = (max - start) / delta;
      enter = Math.max(enter, Math.min(lo, hi));
      exit = Math.min(exit, Math.max(lo, hi));
      if (enter > exit) return false;
    }
  }
  return true;
}

function workPoints(item: WarehouseSpatialItem, cell?: GrowPoint | null) {
  const { front } = getKqWarehouseOrientation(item.rotation);
  const sides = item.kind === "culture"
    ? [front, { x: front.z, z: -front.x }, { x: -front.z, z: front.x }, { x: -front.x, z: -front.z }]
    : [front];
  return sides.flatMap(({ x: nx, z: nz }) => {
    const halfWidth = (nx ? item.depth : item.width) / 2;
    const compact = ["SJ-DRYIT90", "CURTEC-60L", "SIM-STORAGE-03", "LP-SUPER-1L"].includes(item.deviceCode ?? "");
    const half = item.kind === "culture" ? halfWidth : Math.min(halfWidth, compact ? .33 : .85);
    const edge = (nx ? item.width : item.depth) / 2;
    const offsets = cell ? [(cell.x - item.x) * nz - (cell.z - item.z) * nx, 0] : [0];
    for (let offset = .5; offset < half - .12; offset += .5) offsets.push(-offset, offset);
    return offsets.map(offset => ({
      x: item.x + nx * (edge + .33) + nz * offset,
      z: item.z + nz * (edge + .33) - nx * offset,
      yaw: Math.atan2(-nx, -nz),
    }));
  });
}

export function createGrowRoomPaths(layout: WarehouseSpatialLayout) {
  const roomX = layout.width / 2 + 1 - clearance, roomZ = layout.depth / 2 + 1 - clearance;
  const fixtures = [...layout.items, ...(layout.obstacles ?? [])].map(item => ({
    id: item.id, left: item.x - item.width / 2, right: item.x + item.width / 2,
    back: item.z - item.depth / 2, front: item.z + item.depth / 2,
  }));
  const boxes = fixtures.map(b => ({ left: b.left - clearance, right: b.right + clearance, back: b.back - clearance, front: b.front + clearance }));
  const inside = (p: GrowPoint) => Math.abs(p.x) <= roomX && Math.abs(p.z) <= roomZ;
  const canWalk = (a: GrowPoint, b: GrowPoint) => inside(a) && inside(b) && !boxes.some(box => crosses(a, b, box));
  const columns = layout.width * 2 + 3, rows = layout.depth * 2 + 3;
  const nodes = Array.from({ length: columns * rows }, (_, i) => ({
    x: (i % columns - 1 - layout.width) / 2,
    z: (Math.floor(i / columns) - 1 - layout.depth) / 2,
  }));
  const free = nodes.map(p => canWalk(p, p));
  const links = nodes.map((p, i) => free[i] ? [i - columns, i + columns, i - 1, i + 1].filter(j =>
    free[j] && distance(p, nodes[j]) <= .51 && canWalk(p, nodes[j])) : []);

  function route(from: GrowPoint, targetId: string, sector?: KqCareSector) {
    const item = layout.items.find(item => item.id === targetId && item.kind !== "partition");
    if (!item || !canWalk(from, from)) return null;
    const cell = sector && growRoomSectorCenter(item, sector);
    if (sector && !cell) return null;
    const goals = workPoints(item, cell).filter(p => {
      if (!canWalk(p, p)) return false;
      const edge = { x: p.x + .34 * Math.sin(p.yaw), z: p.z + .34 * Math.cos(p.yaw) };
      return !fixtures.some(other => other.id !== targetId && crosses(p, edge, other));
    });
    if (!goals.length) return null;
    // Pick the reachable aisle closest to the requested cell. Walking distance
    // only breaks ties between equally suitable working positions.
    const reach = (p: GrowPoint) => cell ? Math.round(distance(cell, p) * 1000) : 0;
    goals.sort((a, b) => reach(a) - reach(b) || distance(from, a) - distance(from, b));
    const facing = (p: typeof goals[number]) => cell ? Math.atan2(cell.x - p.x, cell.z - p.z) : p.yaw;
    const direct = goals.find(p => canWalk(from, p));
    if (direct && reach(direct) === reach(goals[0])) return { points: [direct], yaw: facing(direct) };

    const parent = new Int32Array(nodes.length).fill(-2);
    const steps = new Float64Array(nodes.length).fill(Infinity);
    const queue: number[] = [];
    nodes.forEach((p, i) => {
      const d = distance(from, p);
      if (free[i] && d <= .8 && canWalk(from, p)) {
        parent[i] = -1;
        steps[i] = d;
        queue.push(i);
      }
    });
    for (let k = 0; k < queue.length; k++) {
      const i = queue[k];
      for (const j of links[i]) {
        if (parent[j] !== -2) continue;
        parent[j] = i;
        steps[j] = steps[i] + .5;
        queue.push(j);
      }
    }
    let best = direct ? distance(from, direct) : Infinity, end = -1, goal = direct;
    for (const candidate of goals) {
      if (goal && reach(candidate) > reach(goal)) break;
      for (const i of queue) {
        const gap = distance(nodes[i], candidate);
        if (gap <= .8 && (!goal || reach(candidate) < reach(goal) || steps[i] + gap < best) && canWalk(nodes[i], candidate)) {
          best = steps[i] + gap;
          end = i;
          goal = candidate;
        }
      }
    }
    if (!goal) return null;
    const path: GrowPoint[] = [goal];
    for (let i = end; i >= 0; i = parent[i]) path.push(nodes[i]);
    path.reverse();
    const points: GrowPoint[] = [];
    let anchor = from;
    for (let i = 0; i < path.length;) {
      let furthest = path.length - 1;
      while (furthest > i && !canWalk(anchor, path[furthest])) furthest--;
      anchor = path[furthest];
      points.push(anchor);
      i = furthest + 1;
    }
    return { points, yaw: facing(goal) };
  }
  /** Choose a nearby stretch of aisle with room for the whole broom stroke. */
  function sweep(from: GrowPoint) {
    if (!canWalk(from, from)) return null;
    // Only the brush enters the far part of the stroke. It needs its own
    // clearance, especially in the one-metre perimeter of a full floor.
    const edge = .07;
    const brushBoxes = fixtures.map(b => ({ left: b.left - edge, right: b.right + edge, back: b.back - edge, front: b.front + edge }));
    const brushFits = (a: GrowPoint, b: GrowPoint) =>
      Math.abs(b.x) <= layout.width / 2 + 1 - edge && Math.abs(b.z) <= layout.depth / 2 + 1 - edge && !brushBoxes.some(box => crosses(a, b, box));
    let best = Infinity, goal: { points: GrowPoint[]; yaw: number } | null = null;
    const alongAisle = [{ x: from.x - 1.5, z: from.z }, { x: from.x + 1.5, z: from.z },
      { x: from.x, z: from.z - 1.5 }, { x: from.x, z: from.z + 1.5 }];
    for (const spot of [...alongAisle, ...nodes, from]) {
      const walk = distance(from, spot);
      if (walk > 2.5) continue;
      const score = Math.abs(walk - 1.6) + .05 * Math.hypot(spot.x, spot.z);
      if (score >= best || !canWalk(from, spot)) continue;
      for (const yaw of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
        const front = { x: Math.sin(yaw), z: Math.cos(yaw) };
        const head = (side: number) => ({ x: spot.x + front.x * .54 + front.z * side, z: spot.z + front.z * .54 - front.x * side });
        const left = head(-.59), right = head(.59);
        if (!brushFits(spot, left) || !brushFits(spot, right) || !brushFits(left, right)) continue;
        goal = { points: [spot], yaw };
        best = score;
        break;
      }
    }
    return goal;
  }
  return { canWalk, route, sweep };
}
