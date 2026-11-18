import { describe, expect, it } from "vitest";
import { Box3, Group, InstancedMesh, Matrix4, OrthographicCamera, Raycaster, Vector3 } from "three";
import { createVillageSheep } from "./village-sheep";
import { createVillageWalkSurface } from "./village-walk-surface";
import { createVillageBuilding } from "./village-buildings";
import { VILLAGE_PLACES, villagePlacePosition } from "./village-layout";
import { VILLAGE_LIGHT } from "./village-lighting";
import { createVillageTerrain, disposeVillageObject } from "./village-terrain";
import type { VillageLifeController, VillageLifeFrame } from "./village-life-types";

const surface = { isWalkable: () => true, isGrazable: () => true, heightAt: (x: number, z: number) => x * 0.031 + z * 0.024 };
const frame: VillageLifeFrame = { time: 0, delta: 1 / 60, reduced: false, quality: "high", detail: 1, visible: () => true };
const flock = (life: VillageLifeController) => life.object.children.filter(object => object.userData.species === "sheep");
const mesh = (life: VillageLifeController, name: string) => life.object.getObjectByName(name) as InstancedMesh;

describe("farm sheep", () => {
  it("takes distinct grazing, watching and walking cycles and stays in the grass beside the farm", () => {
    const terrain = createVillageTerrain();
    const buildings = VILLAGE_PLACES.map(place => ({ place, object: createVillageBuilding(place.id), position: villagePlacePosition(place) }));
    const surface = createVillageWalkSurface(terrain, buildings);
    const life = createVillageSheep(surface), sheep = flock(life);
    const histories = sheep.map(() => new Set<string>());
    const firstWalk = sheep.map(() => Infinity), starts = sheep.map(animal => animal.position.clone());
    const maxDistance = sheep.map(() => 0);
    for (const { place, object, position } of buildings) {
      object.position.set(...position);
      object.scale.setScalar(place.scale);
      object.updateMatrixWorld(true);
    }
    const ray = new Raycaster(), view = new Vector3(1, 1, 1).normalize();
    const buildingsOnly = buildings.map(building => building.object);
    const farm = buildings.find(building => building.place.id === "warehouse")!;
    const farmFocus = new Vector3(farm.position[0], new Box3().setFromObject(farm.object).max.y + 3.75, farm.position[2]);
    const cameras = [new Vector3(-4.3, 1.2, -1.8), farmFocus].flatMap(target =>
      [[1440, 900], [844, 390], [320, 568]].map(([width, height]) => {
        const zoom = Math.min(width / 38, height / 36);
        const horizontal = width / (2 * zoom), vertical = height / (2 * zoom);
        const camera = new OrthographicCamera(-horizontal, horizontal, vertical, -vertical, 0.1, 180);
        camera.position.copy(target).add(new Vector3(32.527, 32.527, 32.527));
        camera.lookAt(target);
        camera.updateMatrixWorld(true);
        return camera;
      }));
    try {
      expect(sheep).toHaveLength(3);
      expect(sheep.every(animal => animal.userData.active)).toBe(true);
      for (let step = 0; step < 60 * 60; step++) {
        life.update({ ...frame, time: step / 60 });
        for (let i = 0; i < sheep.length; i++) {
          const { position, userData } = sheep[i];
          histories[i].add(userData.state);
          if (userData.state === "walking") firstWalk[i] = Math.min(firstWalk[i], step);
          maxDistance[i] = Math.max(maxDistance[i], position.distanceTo(starts[i]));
          if (!surface.isGrazable(position.x, position.z, userData.radius)) throw new Error(`Sheep left the pasture at ${position.toArray()}`);
          if (step % 60) continue;
          const chest = position.clone().add(new Vector3(0, 0.53, 0));
          ray.set(chest, view);
          expect(ray.intersectObjects(buildingsOnly, true)).toHaveLength(0);
          expect(cameras.every(camera => {
            const screen = chest.clone().project(camera);
            return Math.abs(screen.x) < 0.95 && Math.abs(screen.y) < 0.95;
          })).toBe(true);
        }
      }
      expect(histories.every(states => states.size === 3)).toBe(true);
      expect(new Set(firstWalk).size).toBe(sheep.length);
      expect(maxDistance.every(distance => distance > 0.5)).toBe(true);
    } finally {
      life.dispose();
      buildingsOnly.forEach(disposeVillageObject);
      disposeVillageObject(terrain);
    }
  });

  it("excludes path width, access aprons and garden obstacles from otherwise walkable grass", () => {
    const terrain = new Group();
    terrain.userData.groundPaths = [{ samples: [{ x: -14, z: 5 }, { x: -10, z: 5 }], width: 1.4 }];
    terrain.userData.groundAprons = [{ x: -9.8, z: 2.3, radius: 2.6 }];
    terrain.userData.navigationObstacles = [{ x: -13.1, z: 6.2, radius: 1.35 }];
    const surface = createVillageWalkSurface(terrain, []);
    expect(surface.isWalkable(-12, 5, 0.24)).toBe(true);
    expect(surface.isGrazable(-12, 5, 0.24)).toBe(false);
    expect(surface.isWalkable(-9.8, 2.3, 0.24)).toBe(true);
    expect(surface.isGrazable(-9.8, 2.3, 0.24)).toBe(false);
    expect(surface.isGrazable(-13.1, 6.2, 0.24)).toBe(false);
    expect(surface.isGrazable(-14.6, 6.5, 0.24)).toBe(false);
    expect(surface.isGrazable(-14.65, 3, 0.24)).toBe(true);
  });

  it("holds the hoof in world space during stance and animates its head, jaw and ears", () => {
    const life = createVillageSheep(surface), sheep = flock(life);
    const legs = mesh(life, "sheep-legs"), matrix = new Matrix4(), sole = new Vector3();
    const lastContact = Array.from({ length: 12 }, () => new Vector3(Infinity, Infinity, Infinity));
    let lift = 0, planted = 0, chew = 0, earFlick = 0, headUp = 0, headDown = 0;
    for (let step = 0; step < 30 * 25; step++) {
      life.update({ ...frame, time: step / 30, delta: 1 / 30 });
      for (const animal of sheep) {
        expect(animal.userData.groundedFeet).toBeGreaterThanOrEqual(3);
        chew = Math.max(chew, animal.userData.jawPitch);
        earFlick = Math.max(earFlick, Math.abs(animal.userData.earAngles[0] - 0.17));
        if (animal.userData.headPitch < 0.12) headUp++;
        if (animal.userData.headPitch > 1.37) headDown++;
      }
      for (let i = 0; i < legs.count; i++) {
        legs.getMatrixAt(i, matrix);
        sole.set(0, -0.45, 0).applyMatrix4(matrix);
        const height = sole.y - surface.heightAt(sole.x, sole.z);
        if (height < -1e-6) throw new Error(`Hoof sank by ${-height}`);
        if (height > 0.02) lift++;
        if (height < 1e-6) {
          if (Number.isFinite(lastContact[i].y)) {
            expect(lastContact[i].distanceTo(sole)).toBeLessThan(0.0001);
            planted++;
          }
          lastContact[i].copy(sole);
        } else lastContact[i].y = Infinity;
      }
    }
    for (const count of [lift, planted, headUp, headDown]) expect(count).toBeGreaterThan(100);
    expect(chew).toBeGreaterThan(0.18);
    expect(earFlick).toBeGreaterThan(0.13);
    life.dispose();
  });

  it("batches the flock, swaps detail and freezes or removes work when motion is stopped or outside view", () => {
    const life = createVillageSheep(surface), sheep = flock(life);
    const low = mesh(life, "sheep-fleece-low"), high = mesh(life, "sheep-fleece-high");
    const legs = mesh(life, "sheep-legs"), jaw = mesh(life, "sheep-jaw"), ears = mesh(life, "sheep-ears");
    const shadow = mesh(life, "sheep-contact-shadow");
    life.update({ ...frame, detail: 0, quality: "low" });
    expect([low.count, high.count, legs.count, jaw.count, ears.count]).toEqual([3, 0, 12, 0, 0]);
    expect(low.geometry.index!.count).toBeLessThan(high.geometry.index!.count);
    expect(low.material).toBe(high.material);
    const matrix = new Matrix4(), mark = new Vector3(), sole = new Vector3();
    const [lightX, , lightZ] = VILLAGE_LIGHT.key.position;
    const direction = new Vector3(-lightX, 0, -lightZ).normalize();
    expect(shadow.count).toBe(15);
    for (let i = 0; i < sheep.length; i++) {
      shadow.getMatrixAt(i * 5, matrix);
      mark.setFromMatrixPosition(matrix).sub(sheep[i].position);
      expect(mark.dot(direction)).toBeGreaterThan(0.45);
      expect(new Vector3(mark.x, 0, mark.z).normalize().dot(direction)).toBeCloseTo(1, 5);
      for (let foot = 0; foot < 4; foot++) {
        legs.getMatrixAt(i * 4 + foot, matrix);
        sole.set(0, -0.45, 0).applyMatrix4(matrix);
        shadow.getMatrixAt(i * 5 + foot + 1, matrix);
        mark.setFromMatrixPosition(matrix);
        expect(mark.x).toBeCloseTo(sole.x, 5);
        expect(mark.z).toBeCloseTo(sole.z, 5);
        expect(mark.y - sole.y).toBeCloseTo(0.008, 5);
      }
    }
    life.update({ ...frame, visible: animal => animal === sheep[1] });
    expect([low.count, high.count, legs.count, jaw.count, ears.count]).toEqual([0, 1, 4, 1, 2]);
    expect(shadow.count).toBe(5);
    for (let i = 0; i < 260; i++) life.update(frame);
    const locations = sheep.map(animal => animal.position.toArray());
    const version = legs.instanceMatrix.version;
    life.update({ ...frame, delta: 0 });
    expect(legs.instanceMatrix.version).toBe(version);
    for (let i = 0; i < 260; i++) life.update({ ...frame, visible: () => false });
    expect([low, high, legs, jaw, ears, shadow].every(batch => !batch.count && !batch.visible)).toBe(true);
    for (let i = 0; i < 260; i++) life.update({ ...frame, reduced: true });
    expect(sheep.map(animal => animal.position.toArray())).toEqual(locations);
    expect(sheep.every(animal => animal.userData.groundedFeet === 4 && animal.userData.speed === 0)).toBe(true);
    let disposals = 0;
    high.addEventListener("dispose", () => { disposals++; });
    life.dispose();
    life.dispose();
    expect(disposals).toBe(1);
  });
});
