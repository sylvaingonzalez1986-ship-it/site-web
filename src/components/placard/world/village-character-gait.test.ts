import { Group, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { createVillageCharacterGait, VILLAGE_CHARACTER_STRIDE_PER_METER } from "./village-character-gait";

function createTestRig(ground = 0) {
  const root = new Group(), upperLength = 0.32, lowerLength = 0.31, soleHeight = 0.105;
  const legs = [-1, 1].map(side => {
    const hip = new Group(), knee = new Group(), ankle = new Group();
    hip.position.set(side * 0.125, 0.72 + ground, 0);
    knee.position.y = -upperLength;
    ankle.position.y = -lowerLength;
    root.add(hip); hip.add(knee); knee.add(ankle);
    return { hip, knee, ankle };
  });
  const update = createVillageCharacterGait({ left: legs[0], right: legs[1], upperLength, lowerLength, soleHeight });
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
});
