import * as THREE from "three";
import { createCanvas } from "@napi-rs/canvas";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { WarehouseSpatialItem } from "@/lib/kanab-quest-warehouse-spatial";
import { createRoomResources, type RoomResources } from "./KqGrowRoomGeometry";
import { makeGrowStation, releaseStation } from "./KqGrowRoomWorldArt";

describe("installed service furniture", () => {
  let resources: RoomResources;
  beforeAll(() => {
    vi.stubGlobal("document", { createElement: () => createCanvas(256, 256) });
    try { resources = createRoomResources(); } finally { vi.unstubAllGlobals(); }
  });
  afterAll(() => resources.dispose());

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
