import { describe, expect, it } from "vitest";
import { getKqMissionLevel, isKqLevelRewardCode, isKqMissionProgression } from "./kanab-quest-mission-progression";
import { KQ_MISSION_DEFINITIONS, KQ_MISSION_TRACKS, getKqMissionRewardLabel } from "./kanab-quest-missions";

describe("permanent challenge experience", () => {
  it("starts at level one, carries surplus XP and reaches each exact threshold", () => {
    expect(getKqMissionLevel(0)).toEqual({ totalXp: 0, level: 1, levelXp: 0, nextLevelXp: 100 });
    expect(getKqMissionLevel(99).level).toBe(1);
    expect(getKqMissionLevel(100)).toEqual({ totalXp: 100, level: 2, levelXp: 0, nextLevelXp: 150 });
    expect(getKqMissionLevel(275)).toEqual({ totalXp: 275, level: 3, levelXp: 25, nextLevelXp: 200 });
    expect(getKqMissionLevel(10450)).toEqual({ totalXp: 10450, level: 20, levelXp: 0, nextLevelXp: null });
    expect(getKqMissionLevel(12600)).toEqual({ totalXp: 12600, level: 20, levelXp: 2150, nextLevelXp: null });
  });
  it("covers twelve sectors with attainable final level and stable one-off XP", () => {
    expect(KQ_MISSION_TRACKS).toHaveLength(12);
    expect(KQ_MISSION_DEFINITIONS).toHaveLength(72);
    expect(new Set(KQ_MISSION_DEFINITIONS.map(m => m.code)).size).toBe(72);
    for (const track of KQ_MISSION_TRACKS) {
      const definitions = KQ_MISSION_DEFINITIONS.filter(m => m.track === track);
      expect(definitions.map(m => m.step)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(definitions.map(m => m.xp)).toEqual([50, 100, 150, 200, 250, 300]);
    }
    expect(getKqMissionLevel(KQ_MISSION_DEFINITIONS.reduce((sum, m) => sum + m.xp, 0)).level).toBe(20);
  });
  it("accepts only canonical level reward codes", () => {
    for (const code of ["level-2", "level-10", "level-20"]) expect(isKqLevelRewardCode(code)).toBe(true);
    for (const code of ["level-1", "level-21", "level-02", "level-2.0", "level-2\n", "__proto__", 2, null]) expect(isKqLevelRewardCode(code)).toBe(false);
  });
  it("never replaces unavailable progress by a fabricated level", () => {
    for (const value of [null, {}, { totalXp: 0, rewards: [null] }, { ...getKqMissionLevel(0), rewards: [] }]) expect(isKqMissionProgression(value)).toBe(false);
    const rewards = Array.from({ length: 19 }, (_, i) => ({ code: `level-${i + 2}`, level: i + 2,
      requiredXp: (i + 1) * (i + 4) * 25, reward: { kind: "cash", amountCents: 5000 }, rewardAvailable: true, claimed: false, claimable: false }));
    const valid = { ...getKqMissionLevel(0), rewards };
    expect(isKqMissionProgression(valid)).toBe(true);
    expect(isKqMissionProgression({ ...valid, level: 3 })).toBe(false);
    expect(isKqMissionProgression({ ...valid, rewards: [...rewards.slice(1), rewards[1]] })).toBe(false);
    expect(isKqMissionProgression({ ...valid, rewards: rewards.map(r => ({ ...r, claimable: true })) })).toBe(false);
  });
  it("names every playable Buddie rarity and distinguishes money from cards", () => {
    expect(["common", "silver", "gold", "epic", "legendary"].map(rarity => getKqMissionRewardLabel({ kind: "buddie", rarity: rarity as "common" })))
      .toEqual(["Buddie Commun", "Buddie Argent", "Buddie Or", "Buddie Épique", "Buddie Légendaire"]);
    expect(getKqMissionRewardLabel({ kind: "cash", amountCents: 15000 })).toBe("150 € de jeu");
  });
});
