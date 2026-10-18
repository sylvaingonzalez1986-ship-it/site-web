import { describe, expect, it } from "vitest";
import { ARENA_FORMULA_VERSION } from "@/lib/arena-ranking";
import {
  ARENA_CUSTOMER_REWARD_DICE_RATES,
  ARENA_CUSTOMER_REWARD_SLOTS,
  buildArenaCustomerRewardPreview,
  getArenaCustomerRewardRateBps,
  isArenaCustomerRewardEligible,
  pickArenaSurpriseCandidate,
  projectArenaCustomerRewardPool,
  type ArenaCustomerRewardStanding,
} from "@/lib/arena-customer-rewards";

const standing = (id: number, rank: number, fields: Partial<ArenaCustomerRewardStanding> = {}): ArenaCustomerRewardStanding => ({
  playerId: `player-${String(id).padStart(4, "0")}`, leaderboardRank: rank, pseudo: `Joueur ${id}`,
  score: 1250.5, rating: 1000, wins: 0, losses: 0, tastedFlowerCount: 1,
  rankingFormulaVersion: ARENA_FORMULA_VERSION, ...fields,
});

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

  it("opens v3 rewards to a validated purchased tasting or three human duels while preserving legacy eligibility", () => {
    expect(isArenaCustomerRewardEligible(standing(1, 1))).toBe(true);
    expect(isArenaCustomerRewardEligible(standing(1, 1, { tastedFlowerCount: 0, wins: 2, losses: 1 }))).toBe(true);
    expect(isArenaCustomerRewardEligible(standing(1, 1, { tastedFlowerCount: 0, wins: 2 }))).toBe(false);
    expect(isArenaCustomerRewardEligible(standing(1, 1, { rankingFormulaVersion: undefined }))).toBe(false);
    expect(isArenaCustomerRewardEligible(standing(1, 1, { rankingFormulaVersion: "arena-v2-development" }))).toBe(false);
  });

  it("shares occupied places between all tied players and never redistributes an ineligible member's share", () => {
    const preview = buildArenaCustomerRewardPreview(100, [standing(3, 1), standing(2, 1, { tastedFlowerCount: 0 }), standing(1, 1), standing(4, 4)]);
    expect(preview.rankingWinners.map(player => ({ id: player.playerId, grams: player.grams, share: player.shareBps }))).toEqual([
      { id: "player-0001", grams: 20, share: 1950 },
      { id: "player-0003", grams: 19, share: 1950 },
      { id: "player-0004", grams: 7, share: 675 },
    ]);
    expect(preview.rankingWinners[0]).toMatchObject({ tiedPlayers: 3, occupiedThroughRank: 3, score: 1250.5 });
    // Slots 1–3 contain 58 g. The ineligible second player keeps 19 g unissued.
    expect(preview.rankingWinners.slice(0, 2).reduce((sum, entry) => sum + entry.grams, 0)).toBe(39);
  });

  it("shares only the remaining Top 10 slots for a tie crossing its boundary and excludes that whole tie from the draw", () => {
    const preview = buildArenaCustomerRewardPreview(100, [standing(1, 9), standing(2, 9), standing(3, 9), standing(4, 12)]);
    expect(preview.rankingWinners.map(player => player.grams)).toEqual([2, 2, 2]);
    expect(preview.rankingWinners.map(player => player.shareBps)).toEqual([240, 240, 240]);
    expect(preview.surpriseCandidates.map(player => player.playerId)).toEqual(["player-0004"]);
  });

  it("can reward more than ten tied players without exceeding the original ranking budget", () => {
    const preview = buildArenaCustomerRewardPreview(100, Array.from({ length: 15 }, (_, index) => standing(index + 1, 1)));
    expect(preview.rankingWinners).toHaveLength(15);
    expect(preview.rankingWinners.every(player => player.grams === 6 && player.shareBps === 600)).toBe(true);
    expect(preview.rankingWinners.reduce((sum, entry) => sum + entry.grams, 0)).toBe(90);
    expect(preview.surpriseCandidates).toHaveLength(0);
  });

  it("keeps deterministic allocation when members repeat or input ordering changes", () => {
    const members = Array.from({ length: 7 }, (_, index) => standing(index + 1, 1));
    const original = buildArenaCustomerRewardPreview(123.4, members);
    const reversed = buildArenaCustomerRewardPreview(123.4, [...members].reverse().concat(members[0]));
    expect(reversed).toEqual(original);
    expect(original.rankingWinners[0].shareBps).toBe(1131.42857143);
    expect(original.rankingWinners.reduce((sum, player) => sum + player.grams, 0)).toBe(original.slots.slice(0, 7).reduce((sum, slot) => sum + slot.grams, 0));
  });

  it("does not reinterpret historical snapshots or discard fractional scores", () => {
    const preview = buildArenaCustomerRewardPreview(100, [standing(1, 1, { rankingFormulaVersion: undefined, wins: 3 }), standing(2, 2, { rankingFormulaVersion: undefined, wins: 3 })]);
    expect(preview.rankingWinners.map(player => [player.grams, player.shareBps, player.score])).toEqual([[27, 2700, 1250.5], [18, 1800, 1250.5]]);
  });
});
