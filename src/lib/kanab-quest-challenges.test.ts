import { describe, expect, it } from "vitest";
import type { KqBattle } from "@/lib/kanab-quest-battle";
import { claimKqChallenges, evaluateKqChallenges, getKqChallengeDayKey, getKqChallengeProgress, getKqDailyChallenges, getKqGameChallengeDate } from "@/lib/kanab-quest-challenges";
import { startKqGame, type KqGameState } from "@/lib/kanab-quest-game";
import { createKqRankProfile } from "@/lib/kanab-quest-ranking";

function fixtures() {
  const game: KqGameState = {
    ...startKqGame(1), phase: "complete", pressure: 2, combos: ["PBI ciblée"],
    history: Array.from({ length: 6 }, (_, index) => ({
      stage: (["Germination", "Enracinement", "Croissance", "Floraison", "Récolte", "Séchage & affinage"] as const)[index],
      situation: `Situation ${index}`, dice: [6, 4, 2] as [number, number, number], total: 2, target: 2,
      outcome: "success" as const, trait: "Stable", sparks: 1,
    })),
  };
  const battle = { status: "verdict", winner: "player", rounds: [0, 1, 2].map((index) => ({ code: String(index), label: "Test", explanation: "Test", playerScore: 70, opponentScore: 60, winner: "player" as const })) } as KqBattle;
  return { game, battle };
}

describe("Kanab Quest daily challenges", () => {
  it("changes day at Paris midnight rather than UTC midnight", () => {
    expect(getKqChallengeDayKey(new Date("2026-07-23T21:59:59Z"))).toBe("2026-07-23");
    expect(getKqChallengeDayKey(new Date("2026-07-23T22:00:00Z"))).toBe("2026-07-24");
  });

  it("keeps the start-day rotation when a culture crosses midnight", () => {
    const { game, battle } = fixtures();
    const datedGame = { ...game, seed: 12345, challengeDayKey: "2026-07-23" };
    expect(getKqChallengeDayKey(getKqGameChallengeDate(datedGame))).toBe("2026-07-23");
    expect(evaluateKqChallenges(datedGame, battle).every((challenge) => challenge.dayKey === "2026-07-23")).toBe(true);
  });

  it("reports lightweight live progress without evaluating the jury", () => {
    const { game } = fixtures();
    expect(getKqChallengeProgress(game, "spark-hunter")).toEqual({ label: "4/4 Étincelles", reached: true });
    expect(getKqChallengeProgress(game, "jury-edge")).toEqual({ label: "Décidé par le jury", reached: false });
  });

  it("selects three deterministic daily objectives without database queries", () => {
    const { game, battle } = fixtures();
    const challenges = evaluateKqChallenges(game, battle, new Date("2026-07-23T12:00:00Z"));
    expect(challenges).toHaveLength(3);
    expect(challenges.every((challenge) => challenge.dayKey === "2026-07-23")).toBe(true);
  });

  it("exposes the same objectives before the culture starts", () => {
    const date = new Date("2026-07-23T12:00:00Z");
    const { game, battle } = fixtures();
    expect(getKqDailyChallenges(date).map((challenge) => challenge.code))
      .toEqual(evaluateKqChallenges(game, battle, date).map((challenge) => challenge.code));
  });

  it("awards each challenge only once per day", () => {
    const { game, battle } = fixtures();
    const challenges = evaluateKqChallenges(game, battle, new Date("2026-07-23T12:00:00Z"));
    const once = claimKqChallenges(createKqRankProfile(), challenges);
    const twice = claimKqChallenges(once, challenges);
    expect(once.seasonPoints).toBe(challenges.filter((challenge) => challenge.completed).reduce((sum, challenge) => sum + challenge.points, 0));
    expect(once.lastSeasonPointsDelta).toBe(once.seasonPoints);
    expect(once.lastClaimedChallengeCodes).toEqual(challenges.filter((challenge) => challenge.completed).map((challenge) => challenge.claimKey));
    expect(twice).toEqual(once);
  });

  it("rotates objectives and creates new claim keys on the next day", () => {
    const { game, battle } = fixtures();
    const first = evaluateKqChallenges(game, battle, new Date("2026-07-23T12:00:00Z"));
    const second = evaluateKqChallenges(game, battle, new Date("2026-07-24T12:00:00Z"));
    expect(first.map((challenge) => challenge.code)).not.toEqual(second.map((challenge) => challenge.code));
    expect(first[0].claimKey).not.toBe(second[0].claimKey);
  });
});
