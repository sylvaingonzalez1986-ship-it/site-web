import { describe, expect, it } from "vitest";
import { createKqWarehouseStarter } from "@/lib/kanab-quest-warehouse";
import type { KqWarehouseViewSnapshot } from "../KqWarehouse";
import { createInteriorRoom } from "./interior-rooms";
import { createInteriorObjectArt, createInteriorRoomArt, disposeInteriorArt } from "./interior-art";
import { createInteriorPortrait } from "./interior-residents";
import { Box3, Mesh, Raycaster, Vector3 } from "three";
import { interiorPositionIsFree } from "./interior-movement";
import { VILLAGE_PLACES } from "./village-layout";

function snapshot(state = createKqWarehouseStarter()): KqWarehouseViewSnapshot {
  return { state, revision: 1, cashCents: 100_000, activeRun: false, legacyActiveRun: false, migrationCreditCents: 0, stockGrams: null, salesGramsPerDay: null };
}

const cutawayDestinations = {
  bank: ["view=treasury&pole=bank&section=loans", "view=treasury&pole=bank&section=savings", "view=treasury&pole=bank&section=stocks", "view=treasury&pole=bank&section=crypto"],
  office: ["view=staff", "view=staff&section=team", "view=staff&section=candidates", "view=staff&section=accounting"],
  market: ["view=market&section=sales", "view=market&section=dashboard", "view=market&section=management", "view=social"],
  missions: ["view=missions", "view=missions&section=community"],
  arena: ["view=arena", "view=harvests&section=storage"],
  shop: ["view=shop", "view=shop&tab=collection", "view=shop&section=buddies"],
} as const;

describe("public cutaway rooms", () => {
  it.each(Object.entries(cutawayDestinations))("%s draws its open foreground and links its activity furniture", (id, queries) => {
    const room = createInteriorRoom(id as keyof typeof cutawayDestinations);
    const objects = room.objects.filter(object => object.kind !== "exit");
    expect(objects.map(object => object.href)).toEqual(queries.map(query => `/arene/placard?${query}`));
    const art = createInteriorRoomArt(room, { cutaway: true });
    const enclosed = createInteriorRoomArt(room);
    try {
      expect(art.children.some(child => child.userData.interiorRoof)).toBe(false);
      expect(enclosed.children.some(child => child.userData.interiorRoof)).toBe(true);
      let hasBackWall = false;
      for (const child of art.children) {
        if (!(child instanceof Mesh)) continue;
        const positions = child.geometry.getAttribute("position");
        for (let i = 0; i < positions.count; i++) {
          if (positions.getY(i) < 0.7) continue;
          const x = positions.getX(i), z = positions.getZ(i);
          if (z < -room.depth / 2 + 0.2) hasBackWall = true;
          const inFrontOfRearWall = z > -room.depth / 2 + 0.35;
          const rightOfLeftWall = x > -room.width / 2 + 0.35;
          if ((inFrontOfRearWall && x > room.width / 2 - 0.05) || (rightOfLeftWall && z > room.depth / 2 - 0.05)) {
            throw new Error(`Foreground architecture obscures the ${id} cutaway`);
          }
        }
      }
      expect(hasBackWall).toBe(true);
      for (const object of objects) {
        const furniture = createInteriorObjectArt(object, room.id);
        try {
          expect(furniture.children.length).toBeGreaterThan(0);
        } finally {
          disposeInteriorArt(furniture);
        }
      }
    } finally {
      disposeInteriorArt(art);
      disposeInteriorArt(enclosed);
    }
  });

  it.each(["banker", "clerk", "accountant", "judge", "host"] as const)(
    "%s keeps the entire portrait within reach of its collar",
    role => {
      const portrait = createInteriorPortrait(role);
      try {
        const bounds = new Box3().setFromObject(portrait, true);
        expect(bounds.min.y).toBeGreaterThan(-.15);
        expect(bounds.max.y).toBeLessThan(.8);
        expect(bounds.max.y - bounds.min.y).toBeGreaterThan(.45);
      } finally {
        disposeInteriorArt(portrait);
      }
    },
  );

  it("keeps the Collection host at floor level and clickable on the face", () => {
    const room = createInteriorRoom("collection");
    const host = room.objects.find(object => object.id === "host")!;
    const model = createInteriorObjectArt(host, room.id);
    try {
      const bounds = new Box3().setFromObject(model);
      expect(bounds.min.y).toBeGreaterThanOrEqual(0);
      expect(bounds.max.y).toBeLessThan(2);
      const ray = new Raycaster(new Vector3(0, 1.49, 2), new Vector3(0, 0, -1));
      expect(ray.intersectObject(model)[0]?.object.name).toBe("host-interior-portrait");
    } finally {
      disposeInteriorArt(model);
    }
  });
});

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
