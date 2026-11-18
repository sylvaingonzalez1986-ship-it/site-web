import { describe, expect, it } from "vitest";
import { createGrowRoomPaths, growRoomSectorCenter } from "./kanab-quest-grow-room-path";
import { createKqWarehouseStarter } from "./kanab-quest-warehouse";
import { getKqWarehouseSpatialLayout, type WarehouseSpatialItem, type WarehouseSpatialLayout } from "./kanab-quest-warehouse-spatial";

const item = (id: string, kind: WarehouseSpatialItem["kind"], x: number, z: number, width = 1, depth = 1): WarehouseSpatialItem =>
  ({ id, kind, x, z, width, depth, name: id, rotation: 0 });
const layout = (items: WarehouseSpatialItem[]): WarehouseSpatialLayout => ({ version: 1, width: 10, depth: 10, entry: { x: 0, z: 5.7 }, items });

describe("actual warehouse walking routes", () => {
  it("uses the free perimeter to sweep even when the beds occupy the whole cultivation floor", () => {
    const full = layout([item("filled", "culture", 0, 0, 10, 10)]);
    const paths = createGrowRoomPaths(full);
    const route = paths.sweep(full.entry)!;
    const spot = route.points.at(-1)!;
    expect(paths.canWalk(full.entry, spot)).toBe(true);
    expect(Math.abs(spot.x - full.entry.x)).toBeGreaterThan(1);
    expect(spot.z).toBeGreaterThan(5);
    expect(spot.z + .54 * Math.cos(route.yaw)).toBeGreaterThan(5.07);
    expect(spot.z + .54 * Math.cos(route.yaw)).toBeLessThan(5.93);
  });
  it("walks around a rotated bed to the edge closest to the exact target, including an obstructed edge", () => {
    const bed = { ...item("bed", "culture", 0, 0, 5, 3), rotation: 90 as const };
    const target = { zoneId: bed.id, x: 1, y: 0 };
    expect(growRoomSectorCenter(bed, target)).toEqual({x: -1, z: -1});
    for (const blocked of [false, true]) {
      const graph = createGrowRoomPaths(layout(blocked ? [bed, item("wall", "partition", 0, -1.55, 6, .1)] : [bed]));
      const start = {x: 2, z: 4};
      const route = graph.route(start, bed.id, target)!;
      let from = start;
      for (const point of route.points) { expect(graph.canWalk(from, point)).toBe(true); from = point; }
      expect(from.x).toBeCloseTo(blocked ? -2.83 : -1);
      expect(from.z).toBeCloseTo(blocked ? -1 : -1.83);
      expect(Math.sin(route.yaw)).toBeCloseTo(blocked ? 1 : 0);
      expect(graph.route(start, bed.id, { ...target, x: 5 })).toBeNull();
      expect(graph.route(start, bed.id, { ...target, zoneId: "other" })).toBeNull();
    }
  });
  it("reaches the real saved objects without crossing their rotated footprints", () => {
    const plan = getKqWarehouseSpatialLayout(createKqWarehouseStarter());
    const graph = createGrowRoomPaths(plan);
    let from = plan.entry;
    for (const station of plan.items.filter(item => item.kind !== "partition")) {
      const route = graph.route(from, station.id)!;
      expect(route).toBeTruthy();
      for (const next of route.points) {
        expect(graph.canWalk(from, next)).toBe(true);
        from = next;
      }
    }
  });
  it.each([
    { rotation: 0, width: 3, depth: 1, x: 2, z: -.17, faceX: 0, faceZ: -1 },
    { rotation: 90, width: 1, depth: 3, x: 2.83, z: -1, faceX: -1, faceZ: 0 },
    { rotation: 180, width: 3, depth: 1, x: 2, z: -1.83, faceX: 0, faceZ: 1 },
    { rotation: 270, width: 1, depth: 3, x: 1.17, z: -1, faceX: 1, faceZ: 0 },
  ] as const)("reaches the service front shown on the plan at $rotation degrees and faces its opening", ({ rotation, width, depth, x, z, faceX, faceZ }) => {
    const station = { ...item("rack", "storage", 2, -1, width, depth), deviceCode: "SIM-STORAGE-03", rotation };
    const plan = layout([station]);
    const route = createGrowRoomPaths(plan).route(plan.entry, station.id)!;
    const last = route.points.at(-1)!;
    expect(last.x).toBeCloseTo(x);
    expect(last.z).toBeCloseTo(z);
    expect(Math.sin(route.yaw)).toBeCloseTo(faceX);
    expect(Math.cos(route.yaw)).toBeCloseTo(faceZ);
    const partition = item("closed-front", "partition", x + faceX * .23, z + faceZ * .23, faceX ? .12 : width, faceZ ? .12 : depth);
    expect(createGrowRoomPaths(layout([station, partition])).route(plan.entry, station.id)).toBeNull();
  });
  it.each(["compact", "historical"])("keeps the south entry and walking paths within the %s floor and its perimeter aisle", floor => {
    const state = createKqWarehouseStarter();
    if (floor === "historical") delete state.floor;
    const plan = getKqWarehouseSpatialLayout(state);
    const graph = createGrowRoomPaths(plan);
    expect(plan.entry.x).toBe(0);
    expect(plan.entry.z).toBeCloseTo(plan.depth / 2 + .7);
    expect(graph.canWalk(plan.entry, plan.entry)).toBe(true);
    const outside = [{ x: -(plan.width / 2 + 1), z: 0 }, { x: plan.width / 2 + 1, z: 0 },
      { x: 0, z: -(plan.depth / 2 + 1) }, { x: 0, z: plan.depth / 2 + 1 }];
    for (const edge of outside) expect(graph.canWalk(plan.entry, edge)).toBe(false);
    for (const station of plan.items) expect(graph.route(plan.entry, station.id)).toBeTruthy();
  });
  it("sweeps each segment through half-cell walls and routes around one without clipping its tip", () => {
    const plan = layout([item("wall", "partition", 0, .5, 5, .12), item("rack", "drying", 0, -2)]);
    const graph = createGrowRoomPaths(plan);
    expect(graph.canWalk({ x: 0, z: 1 }, { x: 0, z: 0 })).toBe(false);
    const route = graph.route(plan.entry, "rack")!;
    expect(route.points.length).toBeGreaterThan(1);
    let point = plan.entry;
    for (const next of route.points) {
      expect(graph.canWalk(point, next)).toBe(true);
      point = next;
    }
  });
  it("rejects a closed rack front, including a separating wall between a free hand position and the shelf", () => {
    const rack = item("rack", "drying", 0, 0, 2, 1);
    expect(createGrowRoomPaths(layout([rack, item("wall", "partition", 0, .52, 2.5, .04)])).route({ x: 0, z: 1 }, "rack")).toBeNull();
    expect(createGrowRoomPaths(layout([rack, item("blocked", "culture", 0, 1.1, 2, 1)])).route({ x: 0, z: 4 }, "rack")).toBeNull();
    expect(createGrowRoomPaths(layout([rack])).route({ x: 0, z: 4 }, "missing")).toBeNull();
  });
});
