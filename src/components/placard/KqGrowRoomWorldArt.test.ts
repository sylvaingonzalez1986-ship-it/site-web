import * as THREE from "three";
import { createCanvas } from "@napi-rs/canvas";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { WarehouseSpatialItem } from "@/lib/kanab-quest-warehouse-spatial";
import { getKqWarehouseZoneLightingLayout } from "@/lib/kanab-quest-warehouse-fixtures";
import { KQ_WAREHOUSE_UNLIT_CODE } from "@/lib/kanab-quest-warehouse";
import { createRoomResources, type RoomResources } from "./KqGrowRoomGeometry";
import { makeGrowStation, releaseStation } from "./KqGrowRoomWorldArt";

describe("installed service furniture", () => {
  let resources: RoomResources;
  beforeAll(() => {
    vi.stubGlobal("document", { createElement: () => createCanvas(256, 256) });
    try { resources = createRoomResources(); } finally { vi.unstubAllGlobals(); }
  });
  afterAll(() => resources.dispose());

  it.each([0, 90, 180, 270] as const)("positions instanced lights over the paid footprints at %d degrees", rotation => {
    const item: WarehouseSpatialItem = { id: "bed", name: "Culture", kind: "culture", x: 3, z: -1, width: 3, depth: 7, rotation };
    const lightingCode = "SIM-LIGHT-03";
    const expected = getKqWarehouseZoneLightingLayout({ width: item.width, height: item.depth, rotation, lightingCode });
    const group = makeGrowStation(resources, item, { id: item.id, name: item.name, lightingCode }, 4, true);
    try {
      group.updateMatrixWorld(true);
      const lights = group.getObjectByName("lighting") as THREE.InstancedMesh;
      expect(lights.count).toBe(6);
      for (const [index, { x, z }] of expected.entries()) {
        const matrix = new THREE.Matrix4();
        lights.getMatrixAt(index, matrix);
        const position = new THREE.Vector3().setFromMatrixPosition(matrix).applyMatrix4(lights.matrixWorld);
        expect(position.x).toBeCloseTo(item.x - item.width / 2 + x);
        expect(position.z).toBeCloseTo(item.z - item.depth / 2 + z);
      }
    } finally { releaseStation(group); }
  });

  it("omits lights in unlit zones while retaining the historical fan model", () => {
    const item: WarehouseSpatialItem = { id: "bed", name: "Culture", kind: "culture", x: 0, z: 0, width: 1, depth: 1, rotation: 0 };
    const room = { id: item.id, name: item.name, lightingCode: KQ_WAREHOUSE_UNLIT_CODE, airCode: "AIR-STARTER" };
    const unlit = makeGrowStation(resources, item, room, 4, true);
    const historical = makeGrowStation(resources, item, { ...room, lightingCode: "LED-150-STARTER" }, 4, true);
    try {
      expect(unlit.getObjectByName("lighting")).toBeUndefined();
      expect(historical.getObjectByName("lighting")).toBeInstanceOf(THREE.InstancedMesh);
      expect(historical.getObjectByName("rotor-still")).toBeInstanceOf(THREE.InstancedMesh);
    } finally { releaseStation(unlit); releaseStation(historical); }
  });

  it.each([
    ["SJ-DRYIT90", "drying", "service-drying", 1],
    ["SIM-DRYING-03", "drying", "service-drying", 1],
    ["LP-SUPER-1L", "storage", "service-case", 4],
    ["BROR-JARS-48", "storage", "service-shelf", 1],
    ["CURTEC-60L", "storage", "service-drum", 4],
  ] as const)("fills every saved metre with %s, including on a distant rotated row", (deviceCode, kind, feature, perCell) => {
    for (const distant of [false, true]) {
      const item: WarehouseSpatialItem = { id: "service", name: "Poste", kind, x: 3, z: -1, width: 1, depth: 7, rotation: 90, deviceCode };
      const group = makeGrowStation(resources, item, { id: item.id, name: item.name, contentState: "occupied" }, 4, distant);
      try {
        group.updateMatrixWorld(true);
        const body = group.getObjectByName(feature) as THREE.InstancedMesh;
        expect(body.count).toBe(item.depth * perCell);
        const counts = new Map<number, number>();
        for (let i = 0; i < body.count; i++) {
          const matrix = new THREE.Matrix4();
          body.getMatrixAt(i, matrix);
          const p = new THREE.Vector3().setFromMatrixPosition(matrix).applyMatrix4(body.matrixWorld);
          expect(p.x).toBeGreaterThan(item.x - .5);
          expect(p.x).toBeLessThan(item.x + .5);
          const row = Math.floor(p.z - (item.z - item.depth / 2));
          counts.set(row, (counts.get(row) ?? 0) + 1);
        }
        expect([...counts.keys()].sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
        expect([...counts.values()]).toEqual(Array(7).fill(perCell));
      } finally { releaseStation(group); }
    }
  });
});
