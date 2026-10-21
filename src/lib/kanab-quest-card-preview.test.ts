import { afterEach, describe, expect, it, vi } from "vitest";
import { createKqCareState, performKqBasicCare } from "./kanab-quest-care";
import * as game from "./kanab-quest-game";
import * as turn from "./kanab-quest-turn-preview";
import { getKqCardPlayPreview } from "./kanab-quest-card-preview";

const card = (code: string) => game.KQ_CARDS.find(entry => entry.code === code)!;

function position(code = "BOTTE-037", situationCode = "SIT-002", overrides: Partial<game.KqGameState> = {}): game.KqGameState {
  const situation = game.KQ_SITUATIONS.find(entry => entry.code === situationCode)!;
  const stageIndex = game.KQ_STAGES.indexOf(situation.stage);
  const situationCodes = ["SIT-001", "SIT-002", "SIT-003", "SIT-004", "SIT-005", "SIT-006"];
  situationCodes[stageIndex] = situationCode;
  return {
    ...game.startKqGame(91, { rulesVersion: 3, deckCodes: [code], varietyCode: "HH2026-020" }),
    situationCodes, stageIndex, phase: "rolled", dice: [1, 2, 4], pressure: 0,
    handCodes: [code], deckCodes: [code], collectionCodes: [code],
    care: { ...createKqCareState(), vitality: 60 }, xp: 10, quality: 4,
    ...overrides,
  };
}

function deterministic(state: game.KqGameState, code: string) {
  const preview = getKqCardPlayPreview(state, card(code), 1);
  expect(preview?.kind).toBe("deterministic");
  if (preview?.kind !== "deterministic") throw new Error("Expected a deterministic comparison");
  return preview;
}

afterEach(() => vi.restoreAllMocks());

describe("card play preview", () => {
  it("compares the visible dice and keeps the card cost separate from validation gains", () => {
    const preview = deterministic(position("BOTTE-021", "SIT-002", { dice: [2, 4, 5] }), "BOTTE-021");
    expect(preview.before).toMatchObject({
      dice: [2, 4, 5], outcome: "success", quality: 6, qualityDelta: 2,
      xpAfterPlay: 10, xpAfterValidation: 12, health: 64, pressure: 0,
    });
    expect(preview.after).toMatchObject({
      dice: [6, 4, 5], outcome: "critical", quality: 7, qualityDelta: 3,
      xpAfterPlay: 8, xpAfterValidation: 12, health: 67, pressure: 0,
    });
  });

  it.each([
    ["BOTTE-019", "SIT-033", [1, 2, 4]],
    ["BOTTE-021", "SIT-002", [2, 4, 5]],
    ["BOTTE-024", "SIT-001", [1, 2, 4]],
    ["BOTTE-028", "SIT-021", [1, 2, 4]],
    ["BOTTE-030", "SIT-006", [2, 3, 4]],
    ["BOTTE-035", "SIT-011", [1, 2, 4]],
    ["BOTTE-037", "SIT-002", [1, 2, 4]],
    ["BOTTE-039", "SIT-002", [1, 1, 1]],
    ["BOTTE-040", "SIT-004", [1, 2, 4]],
    ["BOTTE-041", "SIT-005", [1, 2, 4]],
    ["BOTTE-042", "SIT-006", [1, 2, 4]],
  ] as const)("uses the actual deterministic reaction and stage resolution for %s", (code, situationCode, dice) => {
    const state = position(code, situationCode, { dice: [...dice], pressure: 2 });
    const preview = deterministic(state, code);
    const played = game.playKqCard(state, code);
    for (const [branch, source] of [[preview.before, state], [preview.after, played]] as const) {
      const resolved = game.resolveKqStage(source);
      expect(branch).toMatchObject({
        dice: source.dice, outcome: resolved.lastOutcome,
        health: resolved.care?.vitality ?? null,
        quality: resolved.quality, qualityDelta: resolved.quality - state.quality,
        xpAfterPlay: source.xp, xpAfterValidation: resolved.xp,
        pressure: resolved.pressure, dangers: resolved.history.at(-1)!.dangers,
        dead: game.isKqCultureDead(resolved), rescued: resolved.history.at(-1)!.rescued === true,
      });
    }
  });

  it.each([
    ["BOTTE-002", "aphids"], ["BOTTE-010", "aphids"], ["BOTTE-011", "thrips"],
    ["BOTTE-012", "aphids"], ["BOTTE-022", "mites"], ["BOTTE-023", "thrips"],
  ] as const)("retains the legacy PBI reaction %s without inventing health", (code, pest) => {
    const state = position(code, "SIT-003", { rulesVersion: 2, care: undefined, revealedPest: pest });
    const preview = deterministic(state, code);
    const resolved = game.resolveKqStage(game.playKqCard(state, code));
    expect(preview.before.health).toBeNull();
    expect(preview.after).toMatchObject({ health: null, quality: resolved.quality, xpAfterValidation: resolved.xp });
    expect(getKqCardPlayPreview({ ...state, rulesVersion: 3, care: createKqCareState() }, card(code), 1)).toBeNull();
    expect(getKqCardPlayPreview({ ...state, revealedPest: null }, card(code), 1)).toBeNull();
  });

  it("shows the extra pressure of a rescue and the real remaining Danger protection", () => {
    expect(deterministic(position("BOTTE-024", "SIT-001", { pressure: 2 }), "BOTTE-024").after)
      .toMatchObject({ dice: [4, 2, 4], outcome: "success", pressure: 3, dangers: 0 });
    expect(deterministic(position("BOTTE-039", "SIT-002", { dice: [1, 1, 1] }), "BOTTE-039").after)
      .toMatchObject({ dice: [4, 4, 1], outcome: "success", dangers: 0 });
  });

  it("includes automatic Heritage effects even when spending a card makes the outcome worse", () => {
    const state = position("BOTTE-037", "SIT-002", {
      dice: [2, 2, 2], heritageCode: "HERITAGE-006", heritageUsed: false,
    });
    const preview = deterministic(state, "BOTTE-037");
    expect(preview.before).toMatchObject({ outcome: "success", quality: 6, heritage: { changesOutcome: true } });
    expect(preview.after).toMatchObject({ outcome: "fragile", quality: 5, heritage: null });
  });

  it("includes the first-culture rescue without promising it when a card already saves the plant", () => {
    const state = position("BOTTE-039", "SIT-002", {
      dice: [1, 1, 1], care: { ...createKqCareState(), vitality: 10 },
    });
    const ordinary = deterministic(state, "BOTTE-039");
    expect(ordinary.before).toMatchObject({ health: 0, dead: true, rescued: false });
    expect(ordinary.after).toMatchObject({ health: 16, dead: false, rescued: false });
    const first = deterministic({ ...state, firstCultureRescue: true }, "BOTTE-039");
    expect(first.before).toMatchObject({ health: 15, dead: false, rescued: true });
    expect(first.after).toMatchObject({ health: 16, dead: false, rescued: false });
  });

  it("keeps legacy death and onboarding rescue rules", () => {
    const state = position("BOTTE-039", "SIT-002", { dice: [1, 1, 1], rulesVersion: 2, care: undefined });
    const previous = game.resolveKqStage(state).history;
    const withoutRescue = deterministic({ ...state, history: previous }, "BOTTE-039");
    expect(withoutRescue.before).toMatchObject({ health: null, dead: true, rescued: false });
    expect(withoutRescue.after).toMatchObject({ health: null, dead: false });
    expect(deterministic({ ...state, history: previous, firstCultureRescue: true }, "BOTTE-039").before)
      .toMatchObject({ health: null, dead: false, rescued: true });
  });

  it("includes actual care at validation but never exports hidden diagnoses or care history", () => {
    const state = position("BOTTE-037", "SIT-002", {
      dice: [2, 4, 5], care: { ...createKqCareState(), vitality: 50,
        problems: [{ code: "APHIDS", severity: 2, status: "suspected", trend: "stable", appearedAt: 0, variant: 0 }],
      },
    });
    const cared = performKqBasicCare(state);
    const preview = deterministic(cared, "BOTTE-037");
    expect(preview.before.health).toBeGreaterThan(deterministic(state, "BOTTE-037").before.health!);
    expect(preview.after.health).toBe(game.resolveKqStage(game.playKqCard(cared, "BOTTE-037")).care!.vitality);
    expect(JSON.stringify(preview)).not.toMatch(/APHIDS|puceron|suspected|problems|interventions|history|completedAt/);
  });

  it.each([["BOTTE-006", "SIT-002"], ["BOTTE-018", "SIT-004"]])(
    "does not evaluate or expose any seeded reroll for %s", (code, situationCode) => {
      const play = vi.spyOn(game, "playKqCard").mockImplementation(() => { throw new Error("Random play must not run"); });
      const validation = vi.spyOn(turn, "getKqTurnPreview").mockImplementation(() => { throw new Error("No random validation"); });
      const state = position(code, situationCode);
      const preview = getKqCardPlayPreview(state, card(code), 1);
      expect(preview).toEqual({ kind: "random", description: "Relance des dés : le résultat sera connu après avoir joué la carte." });
      expect(getKqCardPlayPreview({ ...state, seed: 54, rollNonce: 99 }, card(code), 1)).toEqual(preview);
      expect(play).not.toHaveBeenCalled();
      expect(validation).not.toHaveBeenCalled();
    },
  );

  it("describes preparation without playing it or predicting the next dice or diagnosis", () => {
    const play = vi.spyOn(game, "playKqCard").mockImplementation(() => { throw new Error("No preparation simulation"); });
    const validation = vi.spyOn(turn, "getKqTurnPreview").mockImplementation(() => { throw new Error("No future validation"); });
    for (const [code, situationCode, version] of [["BOTTE-017", "SIT-002", 3], ["BOTTE-004", "SIT-003", 2]] as const) {
      const state = position(code, situationCode, { phase: "prepare", dice: null, rulesVersion: version });
      expect(getKqCardPlayPreview(state, card(code), 1)).toEqual({ kind: "preparation", description: card(code).description });
    }
    expect(play).not.toHaveBeenCalled();
    expect(validation).not.toHaveBeenCalled();
  });

  it("uses the authoritative card definition rather than a stale or disguised random effect", () => {
    const state = position("BOTTE-006", "SIT-002");
    expect(getKqCardPlayPreview(state, { ...card("BOTTE-006"), effect: "gentle-recovery", xpCost: 0 }, 1)?.kind).toBe("random");
    expect(getKqCardPlayPreview({ ...state, xp: 0 }, { ...card("BOTTE-006"), xpCost: 0 }, 1)).toBeNull();
    expect(getKqCardPlayPreview(state, { ...card("BOTTE-006"), code: "BOTTE-UNKNOWN" }, 1)).toBeNull();
  });

  it("refuses to simulate a new effect until it enters the reviewed allowlist", () => {
    const future = { ...card("BOTTE-006"), code: "BOTTE-FUTURE", effect: "future-effect" as game.KqSupportEffect };
    game.KQ_CARDS.push(future);
    try {
      const play = vi.spyOn(game, "playKqCard").mockImplementation(() => { throw new Error("Unreviewed effect"); });
      const preview = getKqCardPlayPreview(position(future.code), future, 1);
      expect(preview).toEqual({ kind: "random", description: "L’effet de cette carte ne peut pas être prévisualisé." });
      expect(play).not.toHaveBeenCalled();
    } finally {
      game.KQ_CARDS.splice(game.KQ_CARDS.indexOf(future), 1);
    }
  });

  it("returns no comparison for unavailable inventory, cards or actions", () => {
    const state = position();
    for (const copies of [0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(getKqCardPlayPreview(state, card("BOTTE-037"), copies)).toBeNull();
    }
    for (const overrides of [
      { xp: 0 }, { reactionPlayed: true }, { usedCards: ["BOTTE-037"] }, { handCodes: [] },
      { deckCodes: [] }, { phase: "prepare" }, { phase: "resolved" }, { phase: "complete" },
      { cultureDead: true }, { dice: null }, { dice: [4, 5, 6] },
    ] satisfies Partial<game.KqGameState>[]) {
      expect(getKqCardPlayPreview({ ...state, ...overrides }, card("BOTTE-037"), 1)).toBeNull();
    }
    expect(getKqCardPlayPreview(position("BOTTE-037", "SIT-004"), card("BOTTE-037"), 1)).toBeNull();
    expect(getKqCardPlayPreview(position("BOTTE-039", "SIT-002", { usedCards: ["BOTTE-040"] }), card("BOTTE-039"), 1)).toBeNull();
  });

  it("is repeatable, independent of future randomness and never mutates the input or its dice", () => {
    const state = position("BOTTE-041", "SIT-005");
    const saved = structuredClone(state);
    const preview = deterministic(state, "BOTTE-041");
    expect(deterministic(state, "BOTTE-041")).toEqual(preview);
    expect(deterministic({ ...state, seed: 486, rollNonce: 97,
      situationCodes: [...state.situationCodes.slice(0, 5), "SIT-050"],
    }, "BOTTE-041")).toEqual(preview);
    expect(state).toEqual(saved);
    preview.before.dice[0] = 6;
    preview.after.dice[1] = 6;
    expect(state).toEqual(saved);
  });
});
