import { describe, expect, it } from "vitest";
import { OrthographicCamera, Vector3 } from "three";
import type { WarehouseSpatialLayout } from "@/lib/kanab-quest-warehouse-spatial";
import { CAMERA_HEIGHT, OVERVIEW, cameraScale, clampCamera, projectRoomPoint, unprojectFloor } from "./KqGrowRoomProjection";

const floor = (width: number, depth: number): WarehouseSpatialLayout => ({
  version: 1, width, depth, items: [], entry: { x: 0, z: depth / 2 + .7 },
});

describe("caméra orthographique de l’entrepôt", () => {
  it.each([[10, 10], [40, 25]])("cadre les limites du plateau %i × %i, les murs et le seuil sur mobile", (w, d) => {
    const layout = floor(w, d);
    const width = 296, height = 308;
    const scale = cameraScale(layout, width, height, 1);
    for (const x of [-w / 2 - 1, w / 2 + 1]) {
      for (const z of [-d / 2 - 1, d / 2 + 1]) {
        for (const y of [0, 2.85]) {
          const p = projectRoomPoint(x, y, z, OVERVIEW, scale, width, height);
          expect(p.x).toBeGreaterThan(0);
          expect(p.x).toBeLessThan(width);
          expect(p.y).toBeGreaterThan(0);
          expect(p.y).toBeLessThan(height);
        }
      }
    }
  });

  it("utilise la même projection pour le picking, les repères et le rendu Three après déplacement et zoom", () => {
    const width = 720, height = 440;
    const camera = { zoom: 2.45, x: -1.6, z: 2.1 };
    const scale = cameraScale(floor(10, 10), width, height, camera.zoom);
    const reference = new OrthographicCamera(-width / (2 * scale), width / (2 * scale), height / (2 * scale), -height / (2 * scale), .1, 230);
    const target = new Vector3(camera.x, CAMERA_HEIGHT, camera.z);
    reference.position.copy(new Vector3(12, 12, 16).normalize().multiplyScalar(85)).add(target);
    reference.lookAt(target);
    reference.updateMatrixWorld();
    for (const [x, z] of [[-2.132, 1.47], [3, 0], [-4.1, -1.6]]) {
      const p = projectRoomPoint(x, 0, z, camera, scale, width, height);
      const three = new Vector3(x, 0, z).project(reference);
      expect(p.x).toBeCloseTo((three.x + 1) * width / 2, 6);
      expect(p.y).toBeCloseTo((1 - three.y) * height / 2, 6);
      const hit = unprojectFloor(p.x, p.y, camera, scale, width, height);
      expect(hit.x).toBeCloseTo(x, 7);
      expect(hit.z).toBeCloseTo(z, 7);
    }
  });

  it("revient à la vue complète et borne la caméra à fort grossissement", () => {
    expect(clampCamera({ zoom: .7, x: 8, z: -12 }, floor(10, 10))).toEqual(OVERVIEW);
    const clamped = clampCamera({ zoom: 10, x: 1000, z: 1000 }, floor(40, 25));
    expect(clamped.zoom).toBe(6);
    expect(clamped.x).toBeLessThan(22);
    expect(clamped.z).toBeLessThan(15);
  });
});
