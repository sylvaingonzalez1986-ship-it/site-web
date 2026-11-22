import { expect, test } from "vitest";
import { createVillageBuilding } from "./village-buildings";
import { VILLAGE_KORRIGAN_GLADE, VILLAGE_PLACES, villagePlacePosition } from "./village-layout";
import { createVillageTerrain, disposeVillageObject } from "./village-terrain";
import { createVillageWalkSurface } from "./village-walk-surface";
import { KORRIGAN_SOLE } from "./village-korrigan-art";
import { createVillageKorrigans } from "./village-korrigans";
import type { VillageLifeFrame } from "./village-life-types";

const glade = VILLAGE_KORRIGAN_GLADE;
const frame = (time: number, reduced = false): VillageLifeFrame => ({ time, delta: 1 / 30, reduced, quality: "low", visible: () => true });

test("the permanent oak is solid and the entire round clears the paths and doors", () => {
  const terrain = createVillageTerrain();
  const buildings = VILLAGE_PLACES.map(place => ({ place, position: villagePlacePosition(place), object: createVillageBuilding(place.id) }));
  const surface = createVillageWalkSurface(terrain, buildings);
  expect(surface.isWalkable(glade.x, glade.z, .24)).toBe(false);
  for (let i = 0; i < 36; i++) {
    const angle = i * Math.PI / 18;
    expect(surface.isGrazable(glade.x + Math.cos(angle) * glade.orbitRadius, glade.z + Math.sin(angle) * glade.orbitRadius, .24)).toBe(true);
  }
  buildings.forEach(({ object }) => disposeVillageObject(object));
  disposeVillageObject(terrain);
});

test("the three dancers keep tangent headings, plant their feet and respect reduced motion", () => {
  const round = createVillageKorrigans({ heightAt: () => .01 });
  round.update(frame(0), "idle", 0);
  expect(round.object.visible).toBe(false);
  round.update(frame(0), "idle", 1);
  const before = round.sample();
  let previous = before, fixedContact = 0, stepsOffGround = 0;
  const nearFloor = (height: number) => Math.abs(height - .01 - KORRIGAN_SOLE) < 1e-5;
  for (let i = 1; i <= 120; i++) {
    round.update(frame(i / 30), "idle", 1);
    const next = round.sample();
    next.forEach(({ x, z, yaw, feet }, index) => {
      expect(Math.hypot(x - glade.x, z - glade.z)).toBeCloseTo(glade.orbitRadius);
      expect(Math.sin(yaw)).toBeCloseTo(-(z - glade.z) / glade.orbitRadius);
      expect(Math.cos(yaw)).toBeCloseTo((x - glade.x) / glade.orbitRadius);
      expect(Math.min(...feet.map(foot => foot[1]))).toBeCloseTo(.01 + KORRIGAN_SOLE, 5);
      feet.forEach(([x, y, z], side) => {
        const [priorX, priorY, priorZ] = previous[index].feet[side];
        if (nearFloor(y) && nearFloor(priorY) && Math.hypot(priorX - x, priorZ - z) < 1e-5) fixedContact++;
        if (y > .01 + KORRIGAN_SOLE + .065) stepsOffGround++;
      });
    });
    previous = next;
  }
  expect(fixedContact).toBeGreaterThan(300);
  expect(stepsOffGround).toBeGreaterThan(100);
  expect(previous.map(dancer => dancer.x)).not.toEqual(before.map(dancer => dancer.x));
  expect(previous).toHaveLength(3);
  round.update(frame(4, true), "rare", 1);
  const still = round.sample();
  round.update(frame(8, true), "loss", 1);
  expect(round.sample()).toEqual(still);
  round.update(frame(9), "idle", 0);
  expect(round.object.visible).toBe(false);
  round.dispose();
});
