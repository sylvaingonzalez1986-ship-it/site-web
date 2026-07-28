import { describe, expect, it } from "vitest";
import { createKqOpponent, lockKqBattle, resolveKqBattle, type KqFlowerCard } from "@/lib/kanab-quest-battle";
import { applyKqBattleToRanking, compareKqStandings, createKqRankProfile, getKqLeague, getKqLocalLeaderboard, getKqMatchmaking, getKqRatingStake } from "@/lib/kanab-quest-ranking";

const playerFlower: KqFlowerCard = {
  id: "FLOWER-TEST", ownerName: "Toi", variety: "Cannatonic", tier: "Belle pousse", status: "available", createdAt: new Date(0).toISOString(), integrityCode: "KQ-TEST", traits: [],
  stats: { appearance: 72, aroma: 72, vigor: 72, mastery: 72, regularity: 72 },
};

describe("Kanab Quest local ranking", () => {
  it("shows the exact rating risk and reward before a battle", () => {
    expect(getKqRatingStake(1000, 1000)).toEqual({ win: 12, loss: -12 });
    expect(getKqRatingStake(1000, 1120).win).toBeGreaterThan(getKqRatingStake(1000, 935).win);
    expect(Math.abs(getKqRatingStake(1000, 1120).loss)).toBeLessThan(Math.abs(getKqRatingStake(1000, 935).loss));
  });

  it("turns rating into stable mainstream league milestones", () => {
    expect(getKqLeague(1000)).toMatchObject({ name: "Pousse", pointsToNext: 50, progress: 50 });
    expect(getKqLeague(1250)).toMatchObject({ name: "Grand Cru", pointsToNext: 0, progress: 100 });
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

  it("uses wins then a stable id to resolve complete ties", () => {
    const standings = [
      { id: "z-player", rating: 1000, seasonPoints: 25, wins: 2 },
      { id: "b-player", rating: 1000, seasonPoints: 25, wins: 3 },
      { id: "a-player", rating: 1000, seasonPoints: 25, wins: 3 },
    ].sort(compareKqStandings);
    expect(standings.map((standing) => standing.id)).toEqual(["a-player", "b-player", "z-player"]);
  });
});
