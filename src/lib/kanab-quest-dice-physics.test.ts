import { describe, expect, it } from "vitest";
import { KQ_DIE_SIDE, KQ_DICE_HZ, readKqTopFace, restKqDice, retargetKqDie, simulateKqDice } from "./kanab-quest-dice-physics";

describe("culture dice table", () => {
  it.each([3, 4])("keeps %i physical dice on the cloth with the saved labels uppermost", count => {
    for (let variant = 0; variant < 7; variant++) {
      const faces = Array.from({ length: count }, (_, i) => 1 + (variant + 2 * i) % 6);
      const { frames, firstContact } = simulateKqDice(faces, variant);
      expect(firstContact).toBeGreaterThan(12);
      expect(frames.length).toBeLessThan(KQ_DICE_HZ * 3);
      const end = frames.at(-1)!;
      expect(end.map(pose => readKqTopFace(pose.orientation).face)).toEqual(faces);
      expect(end.every(pose => readKqTopFace(pose.orientation).height > .998)).toBe(true);
      expect(end.every(pose => Math.abs(pose.position.y - KQ_DIE_SIDE / 2) < .012)).toBe(true);
      expect(end.every((pose, i) => !i || pose.position.x > end[i - 1].position.x)).toBe(true);
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
