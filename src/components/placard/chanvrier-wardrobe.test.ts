import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { CHANVRIER_APPEARANCE_OPTIONS, DEFAULT_CHANVRIER_APPEARANCE, getChanvrierColors, type ChanvrierAvatarProfile } from "@/lib/arena-chanvrier";
import { createGrowWorker } from "./kq-grow-worker-model";

const profile: ChanvrierAvatarProfile = { gender: "male", clothing: "sage", skin: "peach", appearance: DEFAULT_CHANVRIER_APPEARANCE };

describe("chanvrier tailoring", () => {
  it("keeps the hips of the embroidered underlayer inside the chupenn while reaching", () => {
    const worker = createGrowWorker({
      ...profile,
      appearance: { ...DEFAULT_CHANVRIER_APPEARANCE, top: "embroidered-vest", jacket: "chupenn" },
    });
    const clothes = ["veste-chupenn", "haut-embroidered-vest"].map(name => worker.object.getObjectByName(name) as THREE.Mesh);
    const probes = clothes.map(cloth => new THREE.Mesh(cloth.geometry, cloth.material));
    for (const phase of [0, .23, .49, .71]) {
      worker.pose(0, 0, "inspect", phase, 4);
      worker.object.updateMatrixWorld(true);
      for (const [i, mesh] of probes.entries()) {
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(clothes[i].matrix);
        mesh.updateMatrixWorld(true);
      }
      for (const y of [-.046, .002, .061, .117]) for (const angle of [.66, 1.30, 1.88, 2.79, 3.45, 4.37, 5.52]) {
        const from = new THREE.Vector3(Math.sin(angle), y, Math.cos(angle));
        const direction = new THREE.Vector3(0, y, 0).sub(from).normalize();
        const visible = new THREE.Raycaster(from, direction).intersectObjects(probes)[0];
        expect(visible?.object, `phase ${phase}, y ${y}, angle ${angle}`).toBe(probes[0]);
      }
    }
    worker.dispose();
  });

  it("matches the planted sole height for each of the six shoe shapes", () => {
    const worker = createGrowWorker(profile, { tools: false });
    for (const { code: shoes } of CHANVRIER_APPEARANCE_OPTIONS.shoes) {
      worker.updateAppearance({ ...profile, appearance: { ...DEFAULT_CHANVRIER_APPEARANCE, shoes } });
      worker.pose(0, 0, null, 0, null);
      worker.object.updateMatrixWorld(true);
      const soles = worker.object.getObjectsByProperty("name", "shoe-and-sole") as THREE.Mesh[];
      expect(soles).toHaveLength(2);
      for (const sole of soles) {
        sole.geometry.computeBoundingBox();
        expect(sole.geometry.boundingBox?.min.y).toBeCloseTo(-.089, 5);
        expect(sole.geometry.boundingBox?.max.z).toBeGreaterThan(.2);
        expect(new THREE.Box3().setFromObject(sole, true).min.y).toBeCloseTo(0, 2);
      }
    }
    worker.dispose();
  });

  it("keeps the folded cuffs distinct from the fabric and ankle in motion", () => {
    const worker = createGrowWorker(profile);
    const skin = new THREE.Color(getChanvrierColors(profile).skin);
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    for (const bottom of ["shorts", "sailor-trousers"] as const) {
      worker.updateAppearance({ ...profile, appearance: { ...DEFAULT_CHANVRIER_APPEARANCE, bottom } });
      for (const [distance, walking, gesture, progress, stage] of [
        [.35, 1, null, 0, null], [0, 0, "water", .5, 0],
      ] as const) {
        worker.pose(distance, walking, gesture, progress, stage);
        for (const side of [-1, 1]) {
          const leg = worker.object.getObjectByName(`chanvrier-leg-${side}`) as THREE.Mesh;
          const position = leg.geometry.getAttribute("position"), color = leg.geometry.getAttribute("color");
          expect(position.array.every(Number.isFinite)).toBe(true);
          const sides = leg.geometry.index!.getX(2);
          const diameter = (row: number) => a.fromBufferAttribute(position, row * sides)
            .distanceTo(b.fromBufferAttribute(position, row * sides + sides / 2));
          const rows = Array.from({ length: position.count / sides }, (_, i) => i);
          if (bottom === "shorts") {
            const skinRow = rows.find(row => Math.abs(color.getX(row * sides) - skin.r) < .00001);
            expect(skinRow).toBeDefined();
            const cuff = Math.max(...rows.slice(skinRow! - 7, skinRow).map(diameter));
            expect(cuff).toBeGreaterThan(diameter(skinRow!) * 1.28);
          } else {
            const cuff = Math.max(...rows.slice(-14).map(diameter));
            expect(cuff).toBeGreaterThan(diameter(rows.at(-1)!) * 1.6);
            expect(cuff).toBeGreaterThan(diameter(8) * 1.04);
          }
        }
      }
    }
    worker.dispose();
  });

  it("recolors the knit in place and isolates two models sharing its material", () => {
    const look: ChanvrierAvatarProfile = {
      ...profile,
      appearance: { ...DEFAULT_CHANVRIER_APPEARANCE, top: "mariniere", accessory: "neckerchief", dyes: { top: "#f5e3be", accent: "#b14b42" } },
    };
    const first = createGrowWorker(look);
    const second = createGrowWorker(look);
    try {
      const torso = (worker: typeof first) => worker.object.getObjectByName("haut-mariniere") as THREE.Mesh;
      const sleeve = (worker: typeof first) => worker.object.getObjectByName("chanvrier-arm--1") as THREE.Mesh;
      const scarf = first.object.getObjectByName("accessoire-neckerchief") as THREE.Mesh;
      const { geometry, material } = torso(first);
      const sleeveGeometry = sleeve(first).geometry;
      const previous = Array.from(geometry.getAttribute("color").array);
      const rest = Array.from(geometry.getAttribute("clothRest").array);
      expect(torso(second).material).toBe(material);

      first.object.rotation.y = Math.PI * .45;
      first.updateAppearance({ ...look, appearance: { ...look.appearance!, dyes: { ...look.appearance!.dyes, stripe: "#225369" } } });
      first.pose(.35, 1, null, 0, null);
      expect(torso(first).geometry).toBe(geometry);
      expect(sleeve(first).geometry).toBe(sleeveGeometry);
      expect(first.object.getObjectByName("accessoire-neckerchief")).toBe(scarf);
      expect(Array.from(geometry.getAttribute("color").array)).not.toEqual(previous);
      expect(Array.from(geometry.getAttribute("clothRest").array)).toEqual(rest);
      expect(Array.from(torso(second).geometry.getAttribute("color").array)).toEqual(previous);
      expect(second.object.rotation.y).toBe(0);
    } finally {
      first.dispose();
      second.dispose();
    }
  });
});
