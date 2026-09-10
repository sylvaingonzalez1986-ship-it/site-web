import { describe, expect, it } from "vitest";
import {
  ARENA_CUSTOMER_REWARD_DICE_RATES,
  ARENA_CUSTOMER_REWARD_SLOTS,
  buildArenaCustomerRewardPreview,
  getArenaCustomerRewardRateBps,
  pickArenaSurpriseCandidate,
  projectArenaCustomerRewardPool,
} from "@/lib/arena-customer-rewards";

describe("arena customer rewards", () => {
  it("reserves 90% for the ranking and 10% for the surprise reward", () => {
    const projection = projectArenaCustomerRewardPool(100);
    expect(projection.rankingPoolGrams).toBe(90);
    expect(projection.surprisePoolGrams).toBe(10);
    expect(projection.slots.map((slot) => slot.grams)).toEqual([27, 18, 13, 7, 7, 4, 4, 4, 3, 3, 10]);
    expect(projection.slots.reduce((sum, slot) => sum + slot.grams, 0)).toBe(100);
  });

  it("keeps decimal grams for the next cycle and never over-allocates", () => {
    const projection = projectArenaCustomerRewardPool(123.49);
    expect(projection.wholePoolGrams).toBe(123);
    expect(projection.carriedGrams).toBe(0.4);
    expect(projection.slots.reduce((sum, slot) => sum + slot.grams, 0)).toBe(123);
  });

  it("uses the actual Top 10 and leaves only lower ranks in the equal-chance reward", () => {
    const standings = Array.from({ length: 13 }, (_, index) => ({
      playerId: `player-${index + 1}`,
      leaderboardRank: index + 1,
      pseudo: `Joueur ${index + 1}`,
      score: 1_000 - index,
      rating: 1_200 - index,
      wins: index === 1 ? 1 : 2,
      losses: 1,
    }));
    const preview = buildArenaCustomerRewardPreview(100, standings);
    expect(preview.rankingWinners).toHaveLength(9);
    expect(preview.rankingWinners.some((winner) => winner.playerId === "player-2")).toBe(false);
    expect(preview.rankingWinners.at(-1)?.playerId).toBe("player-10");
    expect(preview.surpriseCandidates.map((candidate) => candidate.playerId)).toEqual(["player-11", "player-12", "player-13"]);
  });

  it("gives every participant one position in the surprise draw", () => {
    const candidates = ["a", "b", "c"];
    expect(pickArenaSurpriseCandidate(candidates, 1)).toBe("b");
    expect(pickArenaSurpriseCandidate(candidates, 3)).toBeNull();
  });

  it("keeps all configured shares equal to 100%", () => {
    expect(ARENA_CUSTOMER_REWARD_SLOTS.reduce((sum, slot) => sum + slot.shareBps, 0)).toBe(10_000);
  });

  it("maps the rounded collective dice average to the four weekly rates", () => {
    expect(ARENA_CUSTOMER_REWARD_DICE_RATES.map((rate) => rate.ratePercent)).toEqual([1, 4, 7, 10]);
    expect(getArenaCustomerRewardRateBps(null)).toBe(100);
    expect(getArenaCustomerRewardRateBps(2.49)).toBe(100);
    expect(getArenaCustomerRewardRateBps(2.5)).toBe(400);
    expect(getArenaCustomerRewardRateBps(3.5)).toBe(700);
    expect(getArenaCustomerRewardRateBps(4.5)).toBe(1_000);
    expect(getArenaCustomerRewardRateBps(6)).toBe(1_000);
  });
});
