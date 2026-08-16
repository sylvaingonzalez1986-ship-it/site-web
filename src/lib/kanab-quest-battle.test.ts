import { describe, expect, it } from "vitest";
import { advanceKqStage, resolveKqStage, rollKqDice, startKqGame, type KqGameState } from "@/lib/kanab-quest-game";
import { createKqFlower, createKqOpponent, getKqJuryProgram, invertKqBattlePerspective, KQ_JURY_SCENARIO_COUNT, lockKqBattle, resolveKqBattle, resolveKqJuryWinner } from "@/lib/kanab-quest-battle";

function completedGame(seed = 42) {
  let state: KqGameState = startKqGame(seed);
  while (state.phase !== "complete") {
    if (state.phase === "prepare") state = rollKqDice(state);
    if (state.phase === "rolled") state = resolveKqStage(state);
    if (state.phase === "resolved") state = advanceKqStage(state);
  }
  return state;
}

describe("Kanab Quest flower battles", () => {
  it("offers five jury variants in each of the three rounds", () => {
    expect(KQ_JURY_SCENARIO_COUNT).toBe(15);
  });

  it("creates a stable flower snapshot from a completed culture", () => {
    const flower = createKqFlower({ ...completedGame(), completedAt: "2026-07-24T10:00:00.000Z" });
    expect(flower.status).toBe("available");
    expect(flower.createdAt).toBe("2026-07-24T10:00:00.000Z");
    expect(Object.values(flower.stats).every((stat) => stat >= 35 && stat <= 99)).toBe(true);
    expect(Object.values(flower.stats).every((stat) => Number.isInteger(stat * 10))).toBe(true);
    expect(Object.values(flower.stats).some((stat) => !Number.isInteger(stat))).toBe(true);
    expect(flower.traits).toHaveLength(6);
  });

  it("records the real jury time when both flowers burn", () => {
    const player = createKqFlower(completedGame());
    const verdictAt = new Date("2026-07-24T11:30:00.000Z");
    const verdict = resolveKqBattle(lockKqBattle(player, createKqOpponent(42), 42), 42, verdictAt);
    expect(verdict.burnedAt).toBe(verdictAt.toISOString());
  });

  it("locks both flowers and burns both only with the verdict", () => {
    const player = createKqFlower(completedGame());
    const opponent = createKqOpponent(42);
    const locked = lockKqBattle(player, opponent, 42);
    expect(locked.playerFlower.status).toBe("locked");
    expect(locked.opponentFlower.status).toBe("locked");
    const verdict = resolveKqBattle(locked, 42);
    expect(verdict.status).toBe("verdict");
    expect(verdict.rounds).toHaveLength(3);
    expect(verdict.rounds.every((round) => Number.isInteger(round.playerScore * 10) && Number.isInteger(round.opponentScore * 10))).toBe(true);
    expect(verdict.playerFlower.status).toBe("burned");
    expect(verdict.opponentFlower.status).toBe("burned");
  });

  it("evaluates the same verdict from the opponent perspective", () => {
    const player = createKqFlower(completedGame());
    const verdict = resolveKqBattle(lockKqBattle(player, createKqOpponent(42), 42), 42);
    const opponentView = invertKqBattlePerspective(verdict);
    expect(opponentView.playerFlower.id).toBe(verdict.opponentFlower.id);
    expect(opponentView.winner).toBe(verdict.winner === "player" ? "opponent" : "player");
    expect(opponentView.rounds[0].playerScore).toBe(verdict.rounds[0].opponentScore);
    expect(invertKqBattlePerspective(opponentView)).toEqual(verdict);
  });

  it("cannot lock an already burned flower", () => {
    const flower = { ...createKqFlower(completedGame()), status: "burned" as const };
    expect(() => lockKqBattle(flower, createKqOpponent(3), 3)).toThrow("plus disponible");
  });

  it("draws three explained jury scenarios and varies them with the seed", () => {
    const player = createKqFlower(completedGame());
    const first = resolveKqBattle(lockKqBattle(player, createKqOpponent(10), 10), 10);
    const second = resolveKqBattle(lockKqBattle(player, createKqOpponent(11), 11), 11);
    expect(first.rounds.every((round) => round.explanation.length > 20)).toBe(true);
    expect(new Set(first.rounds.map((round) => round.code))).toHaveLength(3);
    expect(first.rounds.map((round) => round.code)).not.toEqual(second.rounds.map((round) => round.code));
  });

  it("avoids the previous jury formats when alternatives exist", () => {
    const player = createKqFlower(completedGame());
    const first = resolveKqBattle(lockKqBattle(player, createKqOpponent(20), 20), 20);
    const recentCodes = first.rounds.map((round) => round.code);
    const second = resolveKqBattle(lockKqBattle(player, createKqOpponent(21), 21), 21, new Date(), recentCodes);
    expect(second.rounds.every((round) => !recentCodes.includes(round.code))).toBe(true);
  });

  it("announces the exact jury program without revealing scores", () => {
    const player = createKqFlower(completedGame());
    const program = getKqJuryProgram(33);
    const verdict = resolveKqBattle(lockKqBattle(player, createKqOpponent(33), 33), 33);
    expect(program.map((round) => round.code)).toEqual(verdict.rounds.map((round) => round.code));
    expect(program.every((round) => !("playerScore" in round))).toBe(true);
  });

  it("makes higher-rated rivals measurably harder over many cultures", () => {
    const winsAgainst = (rating: number) => Array.from({ length: 80 }, (_, index) => {
      const seed = 1000 + index;
      const player = createKqFlower(completedGame(seed));
      const rival = createKqOpponent(seed + 31, { rating });
      return resolveKqBattle(lockKqBattle(player, rival, seed, rating), seed).winner === "player" ? 1 : 0;
    }).reduce<number>((sum, won) => sum + won, 0);
    const accessibleWins = winsAgainst(935);
    const eliteWins = winsAgainst(1120);
    expect(accessibleWins).toBeGreaterThan(eliteWins);
    expect(accessibleWins).toBeLessThan(76);
    expect(eliteWins).toBeGreaterThan(4);
  });

  it("sends exact ties to a deterministic jury vote without favoring the player", () => {
    expect(resolveKqJuryWinner(70, 69, 1, 0)).toEqual({ winner: "player", tieBreak: false });
    expect(resolveKqJuryWinner(69, 70, 1, 0)).toEqual({ winner: "opponent", tieBreak: false });
    const votes = Array.from({ length: 100 }, (_, seed) => resolveKqJuryWinner(70, 70, seed, 0));
    expect(votes.every((vote) => vote.tieBreak)).toBe(true);
    const playerVotes = votes.filter((vote) => vote.winner === "player").length;
    expect(playerVotes).toBeGreaterThan(35);
    expect(playerVotes).toBeLessThan(65);
    expect(resolveKqJuryWinner(70, 70, 42, 1)).toEqual(resolveKqJuryWinner(70, 70, 42, 1));
  });
});
