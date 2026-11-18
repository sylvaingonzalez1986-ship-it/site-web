import { describe, expect, it } from "vitest";
import { findInteriorSpawn, interiorFloorCell, interiorMovementVector, interiorPositionIsFree, moveInteriorPlayer } from "./interior-movement";
import type { InteriorObject } from "./interior-types";
import { Box3, Vector3 } from "three";
import { createInteriorObjectArt, disposeInteriorArt } from "./interior-art";

const cabinet: InteriorObject = { id: "cabinet", kind: "storage", label: "Armoire", x: 0, z: 0, width: 2, depth: 1, rotation: 90 };
const empty = { width: 8, depth: 8, objects: [] as InteriorObject[] };
const furnished = { ...empty, objects: [cabinet] };

describe("interior movement", () => {
  it("snaps floor hits to metre-cell centres and excludes the circulation apron", () => {
    const room = { ...empty, width: 13, depth: 16, workArea: { width: 10, depth: 10 } };
    expect(interiorFloorCell({ x: -4.99, z: 4.99 }, room)).toEqual({ x: -4.5, z: 4.5 });
    expect(interiorFloorCell({ x: 0, z: -0.01 }, room)).toEqual({ x: 0.5, z: -0.5 });
    for (const point of [{ x: 5, z: 0 }, { x: -5.01, z: 0 }, { x: 0, z: 6 }, { x: NaN, z: 0 }]) expect(interiorFloorCell(point, room)).toBeNull();
  });
  it("blocks thin partitions on both axes without tunnelling and permits sliding", () => {
    const wall: InteriorObject = { ...cabinet, id: "wall", kind: "partition", width: 4, depth: 0.12 };
    const horizontal = { ...empty, objects: [wall] };
    const stopped = moveInteriorPlayer({ x: 0, z: 3 }, { x: 0, z: -7 }, horizontal);
    expect(stopped.z).toBeGreaterThanOrEqual(0.28 - 0.00001);
    const slid = moveInteriorPlayer({ x: 0, z: 0.3 }, { x: 1, z: -2 }, horizontal);
    expect(slid.x).toBeCloseTo(1); expect(slid.z).toBeGreaterThanOrEqual(0.28 - 0.00001);
    const vertical = { ...empty, objects: [{ ...wall, width: 0.12, depth: 4 }] };
    expect(moveInteriorPlayer({ x: 3, z: 0 }, { x: -7, z: 0 }, vertical).x).toBeGreaterThanOrEqual(0.28 - 0.00001);
  });
  it("keeps partition artwork inside its physical footprint at both orientations", () => {
    for (const footprint of [{ width: 3, depth: 0.12, rotation: 0 as const }, { width: 0.12, depth: 3, rotation: 90 as const }]) {
      const art = createInteriorObjectArt({ ...cabinet, ...footprint, kind: "partition" });
      const box = new Box3().setFromObject(art), size = box.getSize(new Vector3());
      expect(size.x).toBeLessThanOrEqual(footprint.width + 0.00001);
      expect(size.z).toBeLessThanOrEqual(footprint.depth + 0.00001);
      expect(size.y).toBeCloseTo(2.5); expect(box.min.y).toBeCloseTo(0);
      expect(art.userData.interiorPartition).toBe(true);
      disposeInteriorArt(art);
    }
  });
  it("keeps the player inside all four walls, including large steps", () => {
    for (const delta of [{ x: 30, z: 0 }, { x: -30, z: 0 }, { x: 0, z: 30 }, { x: 0, z: -30 }]) {
      const moved = moveInteriorPlayer({ x: 0, z: 0 }, delta, empty);
      expect(interiorPositionIsFree(moved, empty)).toBe(true);
      expect(Math.max(Math.abs(moved.x), Math.abs(moved.z))).toBeGreaterThan(3.6);
    }
  });
  it("does not tunnel through solid final rotated footprints", () => {
    const moved = moveInteriorPlayer({ x: 0, z: 3 }, { x: 0, z: -6 }, furnished);
    expect(moved.z).toBeGreaterThanOrEqual(0.72 - 0.00001);
    expect(interiorPositionIsFree(moved, furnished)).toBe(true);
  });
  it("slides along furniture and walls", () => {
    const moved = moveInteriorPlayer({ x: 0, z: 0.74 }, { x: 0.8, z: -1 }, furnished);
    expect(moved.x).toBeCloseTo(0.8);
    expect(moved.z).toBeGreaterThan(0.7);
    const wall = moveInteriorPlayer({ x: 3.77, z: 0 }, { x: 1, z: 2 }, empty);
    expect(wall.x).toBeLessThanOrEqual(3.78);
    expect(wall.z).toBeCloseTo(2);
  });
  it("normalizes diagonals and rotates relative to camera yaw", () => {
    expect(Math.hypot(...Object.values(interiorMovementVector(1, 1, 0, 2)))).toBeCloseTo(2);
    expect(interiorMovementVector(0, 1, Math.PI / 2, 2).x).toBeCloseTo(-2);
    expect(interiorMovementVector(1, 0, Math.PI / 2, 2).z).toBeCloseTo(-2);
  });
  it("recovers from overlapping furniture deterministically", () => {
    const room = { ...furnished, objects: [cabinet, { ...cabinet, id: "other", x: 1 }] };
    const spawn = findInteriorSpawn({ x: 0.8, z: 0 }, room);
    expect(interiorPositionIsFree(spawn, room)).toBe(true);
    expect(findInteriorSpawn({ x: 0.8, z: 0 }, room)).toEqual(spawn);
    expect(interiorPositionIsFree(moveInteriorPlayer({ x: 0, z: 0 }, { x: 0, z: 0 }, room), room)).toBe(true);
  });
  it("clamps an out-of-room spawn and preserves a valid spawn", () => {
    expect(findInteriorSpawn({ x: 20, z: -20 }, empty)).toEqual({ x: 3.78, z: -3.78 });
    expect(findInteriorSpawn({ x: 2, z: 2 }, furnished)).toEqual({ x: 2, z: 2 });
  });
  it("recovers directly to a clear configured entrance after confirmed layout changes", () => {
    expect(findInteriorSpawn({ x: 0, z: 0 }, { ...furnished, spawn: [0, 3] })).toEqual({ x: 0, z: 3 });
  });
  it("allows non-solid characters and the exit without treating missing objects as obstacles", () => {
    const room = { ...empty, objects: [{ ...cabinet, solid: false }, { ...cabinet, id: "door", kind: "exit" as const }] };
    expect(interiorPositionIsFree({ x: 0, z: 0 }, room)).toBe(true);
  });
});
