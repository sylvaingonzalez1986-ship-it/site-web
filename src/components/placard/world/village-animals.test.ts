import { describe, expect, it } from "vitest";
import { Mesh, Raycaster, Vector3 } from "three";
import { createVillageAnimals } from "./village-animals";
import type { VillageWalkSurface } from "./village-life-types";
import { createVillageBuilding } from "./village-buildings";
import { createVillageTerrain, disposeVillageObject } from "./village-terrain";
import { createVillageWalkSurface } from "./village-walk-surface";
import { VILLAGE_PLACES, villagePlacePosition } from "./village-layout";

describe("village animals", () => {
  it("keeps seven articulated pieces per animal plus a shared soft contact shadow", () => {
    const life = createVillageAnimals({ isWalkable: () => true, heightAt: () => 0 });
    expect(life.object.children.map(child => child.name)).toEqual(["village-animal-wolf", "village-animal-fox", "village-animal-weasel"]);
    let meshes = 0;
    const shadows: Mesh[] = [];
    life.object.traverse(child => {
      if (!(child instanceof Mesh)) return;
      if (child.name === "animal-contact-shadow") shadows.push(child);
      else meshes++;
      const hits: unknown[] = [];
      child.raycast({} as never, hits as never);
      expect(hits).toEqual([]);
      expect(child.castShadow).toBe(false);
    });
    expect(meshes).toBe(21);
    expect(shadows).toHaveLength(3);
    const { geometry, material } = shadows[0];
    expect(shadows.every(shadow => shadow.geometry === geometry && shadow.material === material)).toBe(true);
    const colors = geometry.getAttribute("color"), positions = geometry.getAttribute("position");
    expect(colors.itemSize).toBe(4);
    expect(colors.getW(0)).toBe(1);
    for (let i = 0; i < positions.count; i++) {
      if (Math.hypot(positions.getX(i), positions.getY(i)) >= 0.499) expect(colors.getW(i)).toBe(0);
    }
    let disposals = 0;
    geometry.addEventListener("dispose", () => { disposals++; });
    life.dispose(); life.dispose();
    expect(disposals).toBe(1);
  });

  it("wanders, sniffs and watches without crossing thin barriers or leaving dry land", () => {
    const walls = [-0.3, 6.8];
    const surface: VillageWalkSurface = {
      isWalkable: (x, z, radius) => Math.abs(x) + radius < 14 && Math.abs(z) + radius < 14 && walls.every(wall => Math.abs(x - wall) > radius + 0.04),
      heightAt: (x, z) => 0.03 * x + 0.02 * z,
    };
    const life = createVillageAnimals(surface);
    const starts = life.object.children.map(child => child.position.clone());
    const previous = starts.map(p => p.clone());
    const moved = new Set<number>(), states = new Set<string>();
    for (let step = 0; step < 60 * 120; step++) {
      life.update({ time: step / 60, delta: 1 / 60, reduced: false, quality: "high", visible: () => true });
      life.object.children.forEach((child, i) => {
        const p = child.position;
        expect(child.userData.active).toBe(true);
        if (!surface.isWalkable(p.x, p.z, child.userData.radius)) throw new Error(`Animal ${i} left the walkable surface`);
        if (Math.hypot(p.x - previous[i].x, p.z - previous[i].z) > 0.012) throw new Error("Animal exceeded its speed limit");
        for (const wall of walls) if ((starts[i].x - wall) * (p.x - wall) <= 0) throw new Error("Animal crossed a thin wall");
        if (p.distanceTo(starts[i]) > 0.5) moved.add(i);
        expect(p.y).toBeCloseTo(surface.heightAt(p.x, p.z));
        states.add(child.userData.state); previous[i].copy(p);
      });
    }
    expect(moved.size).toBe(3);
    expect(states).toEqual(new Set(["watch", "wander", "sniff", "pause"]));
    life.dispose();
  });

  it("freezes for reduced motion and culling, and hides animals if no safe spawn exists", () => {
    const life = createVillageAnimals({ isWalkable: () => true, heightAt: () => 0 });
    for (let i = 0; i < 300; i++) life.update({ time: i / 60, delta: 1 / 60, reduced: false, quality: "low", visible: () => true });
    const positions = life.object.children.map(child => child.position.toArray());
    for (const reduced of [true, false]) {
      for (let i = 0; i < 100; i++) life.update({ time: 100 + i, delta: 1, reduced, quality: "low", visible: () => reduced });
      expect(life.object.children.map(child => child.position.toArray())).toEqual(positions);
    }
    life.dispose();
    const blocked = createVillageAnimals({ isWalkable: () => false, heightAt: () => 0 });
    expect(blocked.object.children.every(child => !child.visible && !child.userData.active)).toBe(true);
    blocked.dispose();
  });

  it("plants paws on graded ground, lifts during the stride and blends the head between states", () => {
    const surface: VillageWalkSurface = { isWalkable: () => true, heightAt: (x, z) => x * 0.03 + z * 0.02 };
    const life = createVillageAnimals(surface);
    const sole = new Vector3();
    const animals = life.object.children.map(object => ({
      object, legs: Array.from({ length: 4 }, (_, i) => object.getObjectByName(`leg-${i}`)!),
      head: object.getObjectByName("head")!, lastPitch: 0, lastLook: 0,
      grounded: 0, lifted: 0, minGrounded: 4, maxDrift: 0, plantedSamples: 0, straightFrames: 0, lastYaw: object.rotation.y,
      paws: Array.from({ length: 4 }, () => new Vector3(Infinity, Infinity, Infinity)),
    }));
    for (let i = 0; i < 2400; i++) {
      life.update({ time: i / 60, delta: 1 / 60, reduced: false, quality: "low", visible: () => true });
      life.object.updateMatrixWorld(true);
      animals.forEach(animal => {
        const { object, head } = animal;
        let grounded = 0;
        const steady = object.userData.speed > 0.43 && Math.abs(animal.lastYaw - object.rotation.y) < 1e-8;
        animal.straightFrames = steady ? animal.straightFrames + 1 : 0;
        animal.legs.forEach((leg, index) => {
          leg.localToWorld(sole.set(0, -leg.position.y, 0.025));
          const clearance = sole.y - surface.heightAt(sole.x, sole.z);
          if (clearance < -1e-8) throw new Error(`${object.name} paw sinks ${clearance}`);
          const previous = animal.paws[index];
          if (clearance < 1e-8) {
            grounded++;
            if (animal.straightFrames > 23 && Number.isFinite(previous.y)) {
              animal.maxDrift = Math.max(animal.maxDrift, Math.hypot(sole.x - previous.x, sole.z - previous.z));
              animal.plantedSamples++;
            }
            previous.copy(sole);
          } else previous.y = Infinity;
          if (clearance > 0.02 && object.userData.speed > 0) animal.lifted++;
        });
        animal.grounded += grounded;
        animal.minGrounded = Math.min(grounded, animal.minGrounded);
        if (Math.abs(animal.lastPitch - head.rotation.x) > 0.12 || Math.abs(animal.lastLook - head.rotation.y) > 0.09) {
          throw new Error(`${object.name} snapped its head between states`);
        }
        animal.lastPitch = head.rotation.x; animal.lastLook = head.rotation.y; animal.lastYaw = object.rotation.y;
      });
    }
    for (const animal of animals) {
      expect(animal.grounded).toBeGreaterThan(2400);
      expect(animal.minGrounded).toBeGreaterThanOrEqual(2);
      expect(animal.lifted).toBeGreaterThan(80);
      expect(animal.plantedSamples).toBeGreaterThan(100);
      expect(animal.maxDrift).toBeLessThan(0.004);
    }
    life.dispose();
  });

  it("keeps the animals in front of roofs from the default overview", () => {
    const terrain = createVillageTerrain();
    const buildings = VILLAGE_PLACES.map(place => ({ place, object: createVillageBuilding(place.id), position: villagePlacePosition(place) }));
    const life = createVillageAnimals(createVillageWalkSurface(terrain, buildings));
    for (const building of buildings) {
      building.object.position.set(...building.position);
      building.object.scale.setScalar(building.place.scale);
      building.object.updateMatrixWorld(true);
    }
    const view = new Vector3(34 - 1.5, 33 - 1.2, 36 - 4).normalize();
    const ray = new Raycaster(); ray.far = 90;
    try {
      for (let tick = 0; tick < 1800; tick++) {
        life.update({ time: tick / 30, delta: 1 / 30, reduced: false, quality: "low", visible: () => true });
        if (tick % 30) continue;
        for (const animal of life.object.children) {
          ray.set(animal.position.clone().add(new Vector3(0, animal.userData.species === "weasel" ? 0.15 : 0.4, 0)), view);
          const hidden = ray.intersectObjects(buildings.map(building => building.object), true);
          expect(hidden.length, `${animal.name} hidden at ${animal.position.toArray()}`).toBe(0);
        }
      }
    } finally { life.dispose(); buildings.forEach(building => disposeVillageObject(building.object)); disposeVillageObject(terrain); }
  });
});
