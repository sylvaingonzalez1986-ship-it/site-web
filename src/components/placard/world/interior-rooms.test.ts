import { describe, expect, it } from "vitest";
import { createKqWarehouseStarter } from "@/lib/kanab-quest-warehouse";
import type { KqWarehouseViewSnapshot } from "../KqWarehouse";
import { createInteriorRoom } from "./interior-rooms";
import { interiorPositionIsFree } from "./interior-movement";
import { VILLAGE_PLACES } from "./village-layout";

function snapshot(state = createKqWarehouseStarter()): KqWarehouseViewSnapshot {
  return { state, revision: 1, cashCents: 100_000, activeRun: false, legacyActiveRun: false, migrationCreditCents: 0, stockGrams: null, salesGramsPerDay: null };
}

describe("interiors connected to the shared game", () => {
  it.each(VILLAGE_PLACES)("$id has a free entry, enclosed furniture and real destinations", place => {
    const room = createInteriorRoom(place.id, snapshot());
    expect(interiorPositionIsFree({ x: room.spawn[0], z: room.spawn[1] }, room)).toBe(true);
    expect(room.objects.find(object => object.kind === "exit")?.solid).toBe(false);
    for (const object of room.objects) {
      expect(Math.abs(object.x) + object.width / 2).toBeLessThanOrEqual(room.width / 2);
      expect(Math.abs(object.z) + object.depth / 2).toBeLessThanOrEqual(room.depth / 2);
      if (object.kind === "exit") continue;
      const href = new URL(object.href!, "https://example.test");
      expect(href.pathname).toBe("/arene/placard");
      expect(["game", "workshop", "harvests", "market", "social", "treasury", "staff", "shop", "arena", "missions", "school"]).toContain(href.searchParams.get("view"));
    }
  });

  it("preserves the historical 40 × 25 floor and all stable IDs", () => {
    const state = createKqWarehouseStarter();
    delete state.floor;
    const untouched = structuredClone(state);
    const room = createInteriorRoom("warehouse", snapshot(state));
    expect(room.workArea).toEqual({ width: 40, depth: 25 });
    expect(state).toEqual(untouched);
    expect(room.objects.filter(object => object.movable).map(object => object.id)).toEqual([...state.zones, ...state.serviceZones!].map(zone => zone.id));
    expect(interiorPositionIsFree({ x: room.spawn[0], z: room.spawn[1] }, room)).toBe(true);
  });

  it("opens the actual ongoing run and renders its owned lighting", () => {
    const data = snapshot();
    data.activeRun = true;
    data.activeRuns = [{ zoneId: "starter", runId: "real-run", buddieCode: "buddy", stageIndex: 1, phase: "growing", startedAt: "2026-11-17T10:00:00Z" }];
    const object = createInteriorRoom("warehouse", data).objects.find(object => object.id === "starter")!;
    expect(object.href).toBe("/arene/placard?view=game&zone=starter&run=real-run");
    expect(object.active).toBe(true);
    expect(object.deviceCode).toBe(data.state.zones[0].lightingCode);
  });

  it("does not invent installed equipment while the server is unavailable", () => {
    const room = createInteriorRoom("warehouse");
    expect(room.objects.some(object => object.movable)).toBe(false);
    expect(room.objects.map(object => object.href).filter(Boolean)).toHaveLength(3);
  });

  it("projects saved partitions as solid walls without inventing an economic activity", () => {
    const data = snapshot();
    data.state.partitions = [{ id: "partition-1", x: 4, y: 2, axis: "x", length: 3 }];
    const room = createInteriorRoom("warehouse", data);
    const wall = room.objects.find(object => object.id === "partition-1")!;
    expect(wall).toMatchObject({ kind: "partition", x: .5, z: -2.5, width: 3, depth: .12, solid: true, movable: true });
    expect(wall.href).toBeUndefined();
    expect(wall.detail).toBe("3 m · Paroi de séparation");
    expect(interiorPositionIsFree({ x: wall.x, z: wall.z }, room)).toBe(false);
  });
});
