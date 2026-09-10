import { describe, expect, it } from "vitest";
import { getKqArenaExperienceAward, getKqSeasonPointStake } from "@/lib/kanab-quest-ranking";
import { auditKqRewardBalance, getKqRemainingDailyChallengePoints, KQ_REWARD_BALANCE } from "@/lib/kanab-quest-reward-balance";

function rounds(won: number) {
  return Array.from({ length: 3 }, (_, index) => ({
    code: `round-${index}`,
    label: `Manche ${index + 1}`,
    playerScore: index < won ? 70 : 50,
    opponentScore: index < won ? 50 : 70,
    winner: index < won ? "player" as const : "opponent" as const,
    explanation: "Test",
  }));
}

describe("Kanab Quest reward balance", () => {
  it("keeps every repeatable PvP reward above bot training", () => {
    expect(auditKqRewardBalance()).toEqual({ valid: true, issues: [] });
    expect(KQ_REWARD_BALANCE.pvp.winnerCardCount).toBeGreaterThan(KQ_REWARD_BALANCE.training.winnerCardCount);
  });

  it("uses the shared balance table in ranking calculations", () => {
    expect(getKqSeasonPointStake(1000, 1000)).toEqual({ win: 20, loss: 5 });
    expect([0, 1, 2, 3].map((won) => getKqArenaExperienceAward(rounds(won))))
      .toEqual([0.6, 0.8, 1.4, 1.6]);
  });

  it("counts challenge points only while their daily receipts are missing", () => {
    const challenges = [
      { claimKey: "2026-09-07:a", points: 8 },
      { claimKey: "2026-09-07:b", points: 15 },
    ];
    expect(getKqRemainingDailyChallengePoints(challenges, [])).toBe(23);
    expect(getKqRemainingDailyChallengePoints(challenges, ["2026-09-07:a"])).toBe(15);
  });
});
