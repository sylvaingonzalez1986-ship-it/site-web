import { Group, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { createVillageCharacterGait, VILLAGE_CHARACTER_STRIDE_PER_METER } from "./village-character-gait";
import { villageApproachSpeed, villageWalkBlend } from "./village-character-motion";

function createTestRig(ground = 0, heightAt?: (x: number, z: number) => number) {
  const root = new Group(), upperLength = 0.32, lowerLength = 0.31, soleHeight = 0.105;
  const legs = [-1, 1].map(side => {
    const hip = new Group(), knee = new Group(), ankle = new Group();
    hip.position.set(side * 0.125, 0.72 + ground, 0);
    knee.position.y = -upperLength;
    ankle.position.y = -lowerLength;
    root.add(hip); hip.add(knee); knee.add(ankle);
    return { hip, knee, ankle };
  });
  const grounding = heightAt && { root, heightAt };
  const update = createVillageCharacterGait({ left: legs[0], right: legs[1], upperLength, lowerLength, soleHeight, ground: grounding });
  return { root, update, legs, soleHeight };
}

describe("village character gait", () => {
  it("plants a level sole as the root moves and clears the ground in swing", () => {
    const { root, update, legs, soleHeight } = createTestRig();
    const sole = new Vector3(), toe = new Vector3(), heel = new Vector3();
    const stanceStart = [NaN, NaN], highest = [0, 0], contactFrames = [0, 0];
    const cycleLength = Math.PI * 2 / VILLAGE_CHARACTER_STRIDE_PER_METER;
    let maxDrift = 0, lowest = Infinity;
    for (let tick = 0; tick < 360; tick++) {
      root.position.z = tick * cycleLength / 120;
      const stride = (root.position.z * VILLAGE_CHARACTER_STRIDE_PER_METER) % (Math.PI * 2);
      expect(update(stride, 1)).toBeGreaterThan(-0.07);
      root.updateMatrixWorld(true);
      let grounded = 0;
      legs.forEach(({ ankle }, i) => {
        ankle.localToWorld(sole.set(0, -soleHeight, 0));
        ankle.localToWorld(toe.set(0, -soleHeight, 0.1));
        ankle.localToWorld(heel.set(0, -soleHeight, -0.06));
        expect(toe.y).toBeCloseTo(heel.y, 8);
        lowest = Math.min(lowest, sole.y);
        highest[i] = Math.max(highest[i], sole.y);
        if (sole.y < 1e-8) {
          grounded++; contactFrames[i]++;
          if (!Number.isFinite(stanceStart[i])) stanceStart[i] = sole.z;
          maxDrift = Math.max(maxDrift, Math.abs(sole.z - stanceStart[i]));
        } else stanceStart[i] = NaN;
      });
      expect(grounded).toBeGreaterThan(0);
    }
    expect(maxDrift).toBeLessThan(1e-8);
    expect(lowest).toBeGreaterThan(-1e-8);
    expect(contactFrames.every(count => count > 200)).toBe(true);
    expect(highest.every(height => height > 0.07)).toBe(true);
  });

  it("settles to both soles on the supplied floor from any interruption phase", () => {
    const ground = 0.08;
    const { root, update, legs, soleHeight } = createTestRig(ground);
    const point = new Vector3();
    for (let tick = 0; tick < 48; tick++) {
      const stride = tick * Math.PI / 24;
      for (let step = 15; step >= 0; step--) {
        update(stride, step / 15, ground);
        root.updateMatrixWorld(true);
        for (const { ankle } of legs) {
          ankle.localToWorld(point.set(0, -soleHeight, 0));
          expect(point.y).toBeGreaterThanOrEqual(ground - 1e-8);
          if (step === 0) {
            expect(point.y).toBeCloseTo(ground, 8);
            expect(point.z).toBeCloseTo(0, 8);
          }
        }
      }
    }
  });

  it("keeps the stance anchor through startup, braking and a moving turn", () => {
    const floor = () => 0;
    function simulate(grounded: boolean) {
      const { root, update, legs, soleHeight } = createTestRig(0, grounded ? floor : undefined);
      const contacts = [new Vector3(), new Vector3()];
      const toeContacts = [new Vector3(), new Vector3()];
      const inContact = [false, false];
      const sole = new Vector3(), toe = new Vector3(), heel = new Vector3();
      const delta = 1 / 60;
      let speed = 0, blend = 0, travelled = 0, drift = 0, firstSteps = 0, lowestPelvis = 0;
      for (let tick = 0; tick < 165; tick++) {
        speed = villageApproachSpeed(speed, tick > 0 && tick < 106 ? 1.55 : 0, delta, 3.8, 3);
        blend = villageWalkBlend(blend, speed, delta);
        if (tick > 55 && tick < 100) root.rotation.y += 0.85 * delta;
        const step = speed * delta;
        root.position.x += Math.sin(root.rotation.y) * step;
        root.position.z += Math.cos(root.rotation.y) * step;
        travelled += step;
        lowestPelvis = Math.min(lowestPelvis, update(travelled * VILLAGE_CHARACTER_STRIDE_PER_METER, blend));
        root.updateMatrixWorld(true);
        let supported = 0;
        legs.forEach(({ ankle }, i) => {
          ankle.localToWorld(sole.set(0, -soleHeight, 0));
          ankle.localToWorld(toe.set(0, -soleHeight, 0.10));
          ankle.localToWorld(heel.set(0, -soleHeight, -0.06));
          expect(toe.y).toBeCloseTo(heel.y, 8);
          expect(sole.y).toBeGreaterThanOrEqual(-1e-8);
          if (sole.y < 1e-8) {
            supported++;
            if (inContact[i]) {
              drift = Math.max(drift, contacts[i].distanceTo(sole), toeContacts[i].distanceTo(toe));
              if (tick < 12) firstSteps = Math.max(firstSteps, contacts[i].distanceTo(sole));
            } else {
              contacts[i].copy(sole);
              toeContacts[i].copy(toe);
            }
            inContact[i] = true;
          } else inContact[i] = false;
        });
        expect(supported).toBeGreaterThan(0);
      }
      return { drift, firstSteps, lowestPelvis };
    }
    const analytical = simulate(false);
    const anchored = simulate(true);
    expect(analytical.firstSteps).toBeGreaterThan(0.19);
    expect(anchored.firstSteps).toBeLessThan(1e-8);
    expect(anchored.drift).toBeLessThan(1e-8);
    expect(anchored.lowestPelvis).toBeGreaterThan(-0.075);
  });

  it("rests each sole on its own level across a path border", () => {
    const grass = 0.006, path = 0.044;
    const { root, update, legs, soleHeight } = createTestRig(0, x => x < 0 ? grass : path);
    root.position.y = path;
    update(0, 0);
    root.updateMatrixWorld(true);
    const point = new Vector3();
    expect(legs[0].ankle.localToWorld(point.set(0, -soleHeight, 0)).y).toBeCloseTo(grass, 8);
    expect(legs[1].ankle.localToWorld(point.set(0, -soleHeight, 0)).y).toBeCloseTo(path, 8);
  });
});
