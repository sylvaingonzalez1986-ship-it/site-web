import { describe, expect, it } from "vitest";
import { createKqWarehouseStarter, getKqWarehouseQuote, getKqWarehouseRunSnapshot, getKqWarehouseSummary, isKqWarehouseRunSnapshot, validateKqWarehouseState, type KqWarehouseState, type KqWarehouseZone, type KqWarehousePartition } from "./kanab-quest-warehouse";
import { getKqWarehouseInaccessibleZoneIds, getKqWarehouseLocalSize, getKqWarehouseOrientation, getKqWarehousePartitionBounds, getKqWarehouseSpatialLayout, moveKqWarehouseSpatialItem, validateKqWarehouseSpatialTransition } from "./kanab-quest-warehouse-spatial";

describe("real warehouse spatial adapter", () => {
  it.each([
    { rotation: 0, x: 0, z: 1, width: 3, depth: 1 },
    { rotation: 90, x: 1, z: 0, width: 1, depth: 3 },
    { rotation: 180, x: 0, z: -1, width: 3, depth: 1 },
    { rotation: 270, x: -1, z: 0, width: 1, depth: 3 },
  ] as const)("draws the same front in SVG and Three for the saved $rotation-degree placement", ({ rotation, x, z, width, depth }) => {
    const { front, yaw, planDegrees } = getKqWarehouseOrientation(rotation);
    expect(front).toEqual({ x, z });
    expect(Math.sin(yaw)).toBeCloseTo(x);
    expect(Math.cos(yaw)).toBeCloseTo(z);
    const svg = planDegrees * Math.PI / 180;
    expect(-Math.sin(svg)).toBeCloseTo(x);
    expect(Math.cos(svg)).toBeCloseTo(z);
    expect(getKqWarehouseLocalSize(width, depth, rotation)).toEqual({ width: 3, depth: 1 });
  });

  it("projects centre-line partitions without changing actual capacities, preparation or cost", () => {
    const state = createKqWarehouseStarter();
    const horizontal: KqWarehousePartition = { id: "wall-x", x: 2, y: 3, axis: "x", length: 4 };
    const vertical: KqWarehousePartition = { id: "wall-y", x: 2, y: 3, axis: "y", length: 4 };
    expect(getKqWarehousePartitionBounds(horizontal, { columns: 10, rows: 10 })).toEqual({ x: -1, z: -1.5, width: 4, depth: 0.12 });
    expect(getKqWarehousePartitionBounds(vertical, { columns: 10, rows: 10 })).toEqual({ x: -2.5, z: 0, width: 0.12, depth: 4 });
    const next = { ...state, partitions: [horizontal, vertical] };
    expect(validateKqWarehouseState(next)).toEqual([]);
    expect(getKqWarehouseSpatialLayout(next).items.filter(item => item.kind === "partition")).toEqual([
      { ...getKqWarehousePartitionBounds(horizontal, { columns: 10, rows: 10 }), id: "wall-x", kind: "partition", name: "Paroi", rotation: 0 },
      { ...getKqWarehousePartitionBounds(vertical, { columns: 10, rows: 10 }), id: "wall-y", kind: "partition", name: "Paroi", rotation: 90 },
    ]);
    const quote = getKqWarehouseQuote(next, state);
    expect(quote.totalCostCents).toBe(0);
    expect(quote.nextState.partitions).toEqual(next.partitions);
    expect(quote.nextState.equipment).toEqual(state.equipment);
    expect(getKqWarehouseSummary(next)).toEqual(getKqWarehouseSummary(state));
    expect(getKqWarehouseQuote(state, quote.nextState).nextState.partitions).toEqual(next.partitions);
    expect(getKqWarehouseQuote({ ...next, partitions: [] }, next).nextState.partitions).toEqual([]);
  });

  it("validates real wall bounds, IDs, lengths, axes, overlaps and joins on either floor", () => {
    const state = createKqWarehouseStarter();
    const wall: KqWarehousePartition = { id: "wall", x: 2, y: 2, axis: "x", length: 2 };
    for (const invalid of [{ ...wall, x: -1 }, { ...wall, y: 10 }, { ...wall, x: 9 }, { ...wall, x: 2.5 }, { ...wall, length: 0 }, { ...wall, length: 1.2 }, { ...wall, axis: "z" }, { ...wall, id: "starter" }]) {
      expect(validateKqWarehouseState({ ...state, partitions: [invalid] })).not.toEqual([]);
    }
    expect(validateKqWarehouseState({ ...state, partitions: [wall, { ...wall, x: 5 }] })).not.toEqual([]);
    expect(validateKqWarehouseState({ ...state, partitions: [wall, { ...wall, id: "overlap", x: 3 }] })).not.toEqual([]);
    expect(validateKqWarehouseState({ ...state, partitions: [wall, { ...wall, id: "joined", x: 4 }] })).toEqual([]);
    expect(validateKqWarehouseState({ ...state, partitions: [{ ...wall, x: 0, y: 0 }] })).not.toEqual([]);
    const crossing: KqWarehouseState = { ...state, partitions: [
      { ...wall, x: 1, y: 4, length: 7 }, { ...wall, id: "cross", x: 4, y: 1, axis: "y", length: 7 },
    ] };
    expect(validateKqWarehouseState(crossing)).toEqual([]);
    expect(validateKqWarehouseSpatialTransition(state, crossing)).toEqual([]);
    expect(validateKqWarehouseState({ ...state, partitions: [
      { ...wall, x: 1, y: 3, length: 6 }, { ...wall, id: "tee", x: 3, y: 3, axis: "y", length: 3 },
    ] })).toEqual([]);
    const legacy = { ...state }; delete legacy.floor;
    expect(validateKqWarehouseState({ ...legacy, partitions: [{ ...wall, x: 39, y: 24, length: 1 }] })).toEqual([]);
  });

  it("freezes copied partition geometry inside new run snapshots and accepts older snapshots", () => {
    const starter = createKqWarehouseStarter();
    const state: KqWarehouseState = { ...starter, partitions: [{ id: "wall", x: 2, y: 2, axis: "x", length: 3 }] };
    const run = getKqWarehouseRunSnapshot(state, 2, "starter");
    expect(isKqWarehouseRunSnapshot(run)).toBe(true);
    expect(run.sourceState.partitions).toEqual(state.partitions);
    state.partitions![0].x = 3;
    expect(run.sourceState.partitions![0].x).toBe(2);
    expect(isKqWarehouseRunSnapshot(getKqWarehouseRunSnapshot(starter, 1))).toBe(true);
  });

  it("permits a one-metre doorway through joined walls, but rejects sealing the occupied room", () => {
    const starter = createKqWarehouseStarter();
    const room: KqWarehouseState = { ...starter, serviceZones: [], zones: [{ ...starter.zones[0], x: 4, y: 4 }], partitions: [
      { id: "top", x: 2, y: 2, axis: "x", length: 6 }, { id: "bottom", x: 2, y: 6, axis: "x", length: 6 },
      { id: "left", x: 2, y: 2, axis: "y", length: 5 }, { id: "right-top", x: 7, y: 2, axis: "y", length: 2 },
      { id: "right-bottom", x: 7, y: 5, axis: "y", length: 2 },
    ] };
    expect(validateKqWarehouseState(room)).toEqual([]);
    expect(getKqWarehouseInaccessibleZoneIds(room)).toEqual([]);
    const closed: KqWarehouseState = { ...room, partitions: [...room.partitions!, { id: "door", x: 7, y: 4, axis: "y", length: 1 }] };
    expect(validateKqWarehouseState(closed)).toEqual([]);
    expect(getKqWarehouseInaccessibleZoneIds(closed)).toEqual(["starter"]);
    expect(validateKqWarehouseSpatialTransition(room, closed)).toEqual(["Garde un passage d’au moins 1 m vers « Première zone »."]);
    expect(validateKqWarehouseSpatialTransition(closed, closed)).toEqual([]);
    expect(validateKqWarehouseSpatialTransition(closed, room)).toEqual([]);
    const omitted = { ...closed }; delete omitted.partitions;
    expect(validateKqWarehouseSpatialTransition(room, omitted)).toEqual([]);
    const colliding = { ...omitted, zones: [{ ...omitted.zones[0], x: 2, y: 2 }] };
    expect(validateKqWarehouseSpatialTransition(room, colliding)).toContain("Une paroi ne peut pas traverser une zone de culture, de séchage ou de stockage.");
  });
  it("projects stable real IDs without converting a legacy floor or introducing reserve devices", () => {
    const state = createKqWarehouseStarter(); delete state.floor;
    state.zones[0] = { ...state.zones[0], x: 30, y: 20 };
    const before = JSON.stringify(state);
    const layout = getKqWarehouseSpatialLayout(state);
    expect(layout).toMatchObject({ version: 1, width: 40, depth: 25, entry: { x: 0, z: 13.2 } });
    expect(layout.items).toHaveLength(3);
    expect(layout.items[0]).toMatchObject({ id: "starter", x: 10.5, z: 8, width: 1, depth: 1, rotation: 0 });
    expect(JSON.stringify(state)).toBe(before);
  });

  it.each(["starter", "starter-drying", "starter-storage"])("moves %s with zero economic or activity change and roundtrips metadata", id => {
    const state = createKqWarehouseStarter();
    const next = moveKqWarehouseSpatialItem(state, id, { x: -1.5, z: -1.5, rotation: 90 });
    expect(next.spatial).toEqual({ version: 1 });
    expect(next.equipment).toEqual(state.equipment);
    expect(next.preparedAreaM2).toBe(state.preparedAreaM2);
    expect(getKqWarehouseSummary(next)).toEqual(getKqWarehouseSummary(state));
    const quote = getKqWarehouseQuote(next, state);
    expect(quote.totalCostCents).toBe(0);
    expect(quote.nextState).toEqual(next);
    expect(getKqWarehouseSpatialLayout(JSON.parse(JSON.stringify(quote.nextState))).items.find(item => item.id === id))
      .toMatchObject({ id, x: -1.5, z: -1.5, rotation: 90 });
  });

  it("rotates a rectangular footprint reversibly while retaining devices, options and capacity", () => {
    const draft = createKqWarehouseStarter(); draft.zones[0].width = 2;
    draft.zones[0].optionCodes = ["SIM-WATER-01"];
    const state = getKqWarehouseQuote(draft).nextState;
    const next = moveKqWarehouseSpatialItem(state, "starter", { x: -2.5, z: -2, rotation: 90 });
    expect(next.zones[0]).toMatchObject({ width: 1, height: 2, x: 2, y: 2, rotation: 90, optionCodes: ["SIM-WATER-01"] });
    expect(getKqWarehouseQuote(next, state).totalCostCents).toBe(0);
    expect(getKqWarehouseSummary(next)).toEqual(getKqWarehouseSummary(state));
    const restored = moveKqWarehouseSpatialItem(next, "starter", { x: -4, z: -4.5, rotation: 0 });
    expect(restored.zones[0]).toMatchObject({ width: 2, height: 1, x: 0, y: 0, rotation: 0 });
  });

  it("rejects missing IDs, non-finite positions, collisions, out of bounds and malformed versions", () => {
    const state = createKqWarehouseStarter();
    expect(() => moveKqWarehouseSpatialItem(state, "gone", { x: 0, z: 0 })).toThrow("n’existe plus");
    expect(() => moveKqWarehouseSpatialItem(state, "starter", { x: NaN, z: 0 })).toThrow("invalide");
    expect(() => moveKqWarehouseSpatialItem(state, "starter", { x: -4.5, z: 4.5 })).toThrow("superposer");
    expect(() => moveKqWarehouseSpatialItem(state, "starter", { x: 6, z: 0 })).toThrow("dépasse");
    expect(validateKqWarehouseState({ ...state, spatial: { version: 2 } })).not.toEqual([]);
    expect(validateKqWarehouseState({ ...state, zones: [{ ...state.zones[0], rotation: 45 }] })).not.toEqual([]);
    expect(validateKqWarehouseState({ ...state, serviceZones: [{ ...state.serviceZones![0], rotation: "90" }] })).not.toEqual([]);
  });

  it("enforces a whole metre passage, while preserving grandfathered access and apron access", () => {
    const seed = createKqWarehouseStarter();
    const zone = (id: string, x: number, y: number, width: number, height: number): KqWarehouseZone => ({ ...seed.zones[0], id, name: id, x, y, width, height });
    const open: KqWarehouseState = { ...seed, serviceZones: [], zones: [zone("inner", 4, 4, 1, 1), zone("left", 3, 3, 1, 3), zone("right", 5, 3, 1, 3), zone("top", 4, 3, 1, 1), zone("bottom", 4, 7, 1, 1)] };
    expect(getKqWarehouseInaccessibleZoneIds(open)).toEqual([]);
    const closed = { ...open, zones: open.zones.map(item => item.id === "bottom" ? { ...item, y: 5 } : item) };
    expect(getKqWarehouseInaccessibleZoneIds(closed)).toEqual(["inner"]);
    expect(validateKqWarehouseSpatialTransition(open, closed)).toEqual(["Garde un passage d’au moins 1 m vers « inner »."]);
    expect(validateKqWarehouseSpatialTransition(closed, closed)).toEqual([]);
    const full = { ...seed, serviceZones: [], zones: [zone("whole floor", 0, 0, 10, 10)] };
    expect(getKqWarehouseInaccessibleZoneIds(full)).toEqual([]);
    expect(validateKqWarehouseSpatialTransition(full, full)).toEqual([]);
  });
});
