import { describe, expect, it } from "vitest";
import { createKqOpponent, lockKqBattle, resolveKqBattle, type KqFlowerCard } from "@/lib/kanab-quest-battle";
import { applyKqBattleToRanking, compareKqStandings, createKqRankProfile, getKqArenaExperienceAward, getKqLeague, getKqLocalLeaderboard, getKqMatchmaking, getKqRatingStake, getKqSeasonPointStake } from "@/lib/kanab-quest-ranking";

const playerFlower: KqFlowerCard = {
  id: "FLOWER-TEST", ownerName: "Toi", variety: "Cannatonic", tier: "Belle pousse", status: "available", createdAt: new Date(0).toISOString(), integrityCode: "KQ-TEST", traits: [],
  stats: { appearance: 72, aroma: 72, vigor: 72, mastery: 72, regularity: 72 },
};

describe("Kanab Quest local ranking", () => {
  it("shows the exact rating risk and reward before a battle", () => {
    expect(getKqRatingStake(1000, 1000)).toEqual({ win: 16, loss: -16 });
    expect(getKqRatingStake(1000, 1120).win).toBeGreaterThan(getKqRatingStake(1000, 935).win);
    expect(Math.abs(getKqRatingStake(1000, 1120).loss)).toBeLessThan(Math.abs(getKqRatingStake(1000, 935).loss));
  });

  it("turns rating into short league divisions", () => {
    expect(getKqLeague(1000)).toMatchObject({ name: "Pousse II", pointsToNext: 50, progress: 0 });
    expect(getKqLeague(1075)).toMatchObject({ name: "Pousse I", pointsToNext: 25, progress: 50 });
    expect(getKqLeague(1400)).toMatchObject({ name: "Grand Cru", pointsToNext: 0, progress: 100 });
  });

  it("awards fewer season points for an expected win and more for an upset", () => {
    expect(getKqSeasonPointStake(1000, 1000)).toEqual({ win: 20, loss: 5 });
    expect(getKqSeasonPointStake(1200, 900).win).toBeLessThan(getKqSeasonPointStake(900, 1200).win);
    expect(getKqSeasonPointStake(1000, 1000, 8).win - getKqSeasonPointStake(1000, 1000).win).toBe(6);
  });

  it("uses the jury score to distinguish Arena experience", () => {
    const sweep = ["player", "player", "player"].map((winner, index) => ({ code: `${index}`, label: "", explanation: "", playerScore: 1, opponentScore: 0, winner: winner as "player" }));
    const closeLoss = ["player", "opponent", "opponent"].map((winner, index) => ({ code: `${index}`, label: "", explanation: "", playerScore: 1, opponentScore: 0, winner: winner as "player" | "opponent" }));
    expect(getKqArenaExperienceAward(sweep)).toBe(1.6);
    expect(getKqArenaExperienceAward(closeLoss)).toBe(0.8);
  });

  it("offers the closest rivals first", () => {
    const rivals = getKqMatchmaking(createKqRankProfile());
    expect(rivals).toHaveLength(3);
    expect(Math.abs(rivals[0].rating - 1000)).toBeLessThanOrEqual(Math.abs(rivals[2].rating - 1000));
  });

  it("keeps offering credible opponents after climbing the ladder", () => {
    const rivals = getKqMatchmaking({ ...createKqRankProfile(), rating: 1250 });
    expect(rivals).toHaveLength(3);
    expect(rivals.some((rival) => rival.rating >= 1235)).toBe(true);
    expect(Math.max(...rivals.map((rival) => Math.abs(rival.rating - 1250)))).toBeLessThanOrEqual(75);
  });

  it("records one ranked result and ignores a duplicate verdict", () => {
    const verdict = resolveKqBattle(lockKqBattle(playerFlower, createKqOpponent(9), 9), 9);
    const initial = createKqRankProfile();
    const once = applyKqBattleToRanking(initial, verdict, 980);
    const twice = applyKqBattleToRanking(once, verdict, 980);
    expect(once.processedBattleIds).toContain(verdict.id);
    expect(once.burnedFlowers).toBe(1);
    expect(once.lastRatingDelta).toBe(once.rating - initial.rating);
    expect(once.lastSeasonPointsDelta).toBe(once.seasonPoints - initial.seasonPoints);
    expect(twice).toEqual(once);
  });

  it("places the local player in a sorted leaderboard", () => {
    const board = getKqLocalLeaderboard({ ...createKqRankProfile(), rating: 1400 });
    expect(board[0]).toMatchObject({ isPlayer: true, rank: 1 });
  });

  it("uses season points to break an equal rating", () => {
    const board = getKqLocalLeaderboard({ ...createKqRankProfile(), rating: 980, seasonPoints: 10 });
    expect(board.find((entry) => entry.isPlayer)!.rank).toBeLessThan(board.find((entry) => entry.id === "rival-maya")!.rank);
  });

  it("uses wins, then fewer losses, then a stable id to resolve complete ties", () => {
    const standings = [
      { id: "z-player", rating: 1000, seasonPoints: 25, wins: 2, losses: 0 },
      { id: "b-player", rating: 1000, seasonPoints: 25, wins: 3, losses: 2 },
      { id: "a-player", rating: 1000, seasonPoints: 25, wins: 3, losses: 1 },
      { id: "c-player", rating: 1000, seasonPoints: 25, wins: 3, losses: 1 },
    ].sort(compareKqStandings);
    expect(standings.map((standing) => standing.id)).toEqual(["a-player", "c-player", "b-player", "z-player"]);
  });
});
