import { describe, expect, it } from "vitest";
import { advanceKqStage, KQ_CARDS, resolveKqStage, rollKqDice, startKqGame, swapKqHeritageHandCard, type KqGameState } from "@/lib/kanab-quest-game";
import { createKqFlower, createKqOpponent, lockKqBattle, resolveKqBattle } from "@/lib/kanab-quest-battle";
import { createKqRankProfile } from "@/lib/kanab-quest-ranking";
import { createKqIntegrityCode, encodeKqSave, parseKqBattleSave, parseKqGameSave, parseKqRankSave } from "@/lib/kanab-quest-persistence";

function completedGame(seed = 33) {
  let state: KqGameState = startKqGame(seed);
  while (state.phase !== "complete") {
    if (state.phase === "prepare") state = rollKqDice(state);
    if (state.phase === "rolled") state = resolveKqStage(state);
    if (state.phase === "resolved") state = advanceKqStage(state);
  }
  return state;
}

describe("Kanab Quest persistence and integrity", () => {
  it("round-trips a valid versioned game save", () => {
    const state = rollKqDice(startKqGame(12));
    expect(parseKqGameSave(encodeKqSave(state))).toEqual(state);
  });

  it("keeps repeated Main prévoyante exchanges reloadable", () => {
    const supportCodes = KQ_CARDS
      .filter((card) => card.category !== "substrate" && card.category !== "pbi")
      .slice(0, 12)
      .map((card) => card.code);
    let state = startKqGame(44, {
      heritageCode: "HERITAGE-003",
      deckCodes: ["BOTTE-001", ...supportCodes],
    });
    for (let index = 0; index < 20; index += 1) {
      state = swapKqHeritageHandCard(state, index % 10, index % 2);
    }
    expect(state.effectNotices).toHaveLength(12);
    expect(parseKqGameSave(encodeKqSave(state))).toEqual(state);
  });

  it("round-trips armed and post-roll Heritage effects", () => {
    const armed = {
      ...startKqGame(12, { heritageCode: "HERITAGE-012" }),
      heritageArmed: true,
    };
    expect(parseKqGameSave(encodeKqSave(armed))).toEqual(armed);
    const canopy = {
      ...rollKqDice(startKqGame(18, { heritageCode: "HERITAGE-011" })),
      heritageUsed: true,
      cancelledDangers: 2,
    };
    expect(parseKqGameSave(encodeKqSave(canopy))).toEqual(canopy);
  });

  it("rejects malformed, unknown-version and impossible dice saves", () => {
    expect(parseKqGameSave("not-json")).toBeNull();
    expect(parseKqGameSave(JSON.stringify({ version: 2, payload: startKqGame(1) }))).toBeNull();
    expect(parseKqGameSave(encodeKqSave({ ...startKqGame(1), dice: [9, 1, 2] }))).toBeNull();
  });

  it("rejects an oversized persisted hand", () => {
    expect(parseKqGameSave(encodeKqSave({ ...startKqGame(1), handCodes: Array.from({ length: 11 }, () => "BOTTE-003") }))).toBeNull();
  });

  it("rejects more than one persisted mulligan", () => {
    expect(parseKqGameSave(encodeKqSave({ ...startKqGame(1), handRedrawsUsed: 2 }))).toBeNull();
  });

  it("rejects injected cards, impossible burn counts and incoherent phases", () => {
    const state = startKqGame(2, { deckCodes: ["BOTTE-001", "BOTTE-003"] });
    expect(parseKqGameSave(encodeKqSave({ ...state, handCodes: ["BOTTE-006"] }))).toBeNull();
    expect(parseKqGameSave(encodeKqSave({ ...state, usedCards: [...state.usedCards, "BOTTE-003", "BOTTE-003"] }))).toBeNull();
    expect(parseKqGameSave(encodeKqSave({ ...state, phase: "resolved" }))).toBeNull();
  });

  it("accepts coherent lock and burn states but rejects an incomplete verdict", () => {
    const game = completedGame();
    const locked = lockKqBattle(createKqFlower(game), createKqOpponent(33), 33);
    expect(parseKqBattleSave(encodeKqSave(locked))?.status).toBe("locked");
    const verdict = resolveKqBattle(locked, 33);
    expect(parseKqBattleSave(encodeKqSave(verdict))?.playerFlower.status).toBe("burned");
    expect(parseKqBattleSave(encodeKqSave({ ...verdict, rounds: [] }))).toBeNull();
  });

  it("rejects duplicated processed battles in a ranking save", () => {
    const profile = { ...createKqRankProfile(), processedBattleIds: ["B-1", "B-1"] };
    expect(parseKqRankSave(encodeKqSave(profile))).toBeNull();
  });

  it("creates a stable receipt that changes with the run history", () => {
    const game = completedGame();
    expect(createKqIntegrityCode(game)).toBe(createKqIntegrityCode(game));
    expect(createKqIntegrityCode({ ...game, seed: game.seed + 1 })).not.toBe(createKqIntegrityCode(game));
    expect(createKqIntegrityCode({ ...game, usedCards: [...game.usedCards, "BOTTE-003"] })).not.toBe(createKqIntegrityCode(game));
    expect(createKqIntegrityCode({ ...game, quality: game.quality + 1 })).not.toBe(createKqIntegrityCode(game));
  });
});
