import { describe, expect, it } from "vitest";
import { gatherKqDice, KQ_DICE_CAST_COUNT, KQ_DIE_SIDE, KQ_DICE_HZ, readKqTopFace, restKqDice, retargetKqDie, simulateKqDice } from "./kanab-quest-dice-physics";

describe("culture dice table", () => {
  it.each([3, 4])("keeps %i physical dice on the cloth with the saved labels uppermost", count => {
    for (let variant = 0; variant < KQ_DICE_CAST_COUNT; variant++) {
      const faces = Array.from({ length: count }, (_, i) => 1 + (variant + 2 * i) % 6);
      const { frames, firstContact, impactPoint } = simulateKqDice(faces, variant);
      expect(firstContact).toBeGreaterThan(12);
      expect(impactPoint.y).toBe(0);
      expect(frames[firstContact].some(pose => pose.position.distanceTo(impactPoint) < KQ_DIE_SIDE)).toBe(true);
      expect(frames.length).toBeLessThan(KQ_DICE_HZ * 3);
      const start = frames[0];
      const end = frames.at(-1)!;
      const hand = gatherKqDice(count, variant);
      expect(start.every(pose => hand.some(slot => slot.distanceTo(pose.position) < .001))).toBe(true);
      const direction = variant % 2 === 0 ? 1 : -1;
      const travel = end.reduce((sum, pose, i) => sum + direction * (pose.position.x - start[i].position.x), 0);
      expect(travel / count).toBeGreaterThan(1.8);
      expect(frames.slice(0, firstContact).some(frame => frame.some((pose, i) =>
        pose.position.y > start[i].position.y + .45))).toBe(true);
      expect(end.map(pose => readKqTopFace(pose.orientation).face)).toEqual(faces);
      expect(end.every(pose => readKqTopFace(pose.orientation).height > .998)).toBe(true);
      expect(end.every(pose => Math.abs(pose.position.y - KQ_DIE_SIDE / 2) < .012)).toBe(true);
      expect(end.every((pose, i) => !i || pose.position.x - end[i - 1].position.x > .65)).toBe(true);
      // Labels remain attached to each body through impact, rolling and sleep.
      expect(frames.slice(1).every((frame, i) => frame.every((pose, j) =>
        pose.orientation.angleTo(frames[i][j].orientation) < .20))).toBe(true);
      // Observed upwards displacement after the first contact is a real rebound.
      expect(frames.slice(firstContact + 1).some((frame, i) => frame.some((pose, j) =>
        pose.position.y > frames[firstContact + i][j].position.y + .006))).toBe(true);
    }
  });

  it("restores and reorients every face, including opposite-face reactions", () => {
    for (let initial = 1; initial <= 6; initial++) {
      const pose = restKqDice([initial, initial, initial])[1];
      expect(readKqTopFace(pose.orientation).face).toBe(initial);
      for (let target = 1; target <= 6; target++) {
        const top = readKqTopFace(retargetKqDie(pose.orientation, target));
        expect(top.face).toBe(target);
        expect(top.height).toBeCloseTo(1);
      }
    }
  });
});
