import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KqTurnPreview } from "@/components/placard/KqTurnPreview";
import { createKqCareState, performKqBasicCare } from "./kanab-quest-care";
import { resolveKqStage, startKqGame, type KqGameState } from "./kanab-quest-game";
import { getKqPressureHint, getKqTurnPreview } from "./kanab-quest-turn-preview";

function position(overrides: Partial<KqGameState> = {}): KqGameState {
  return {
    ...startKqGame(91, { rulesVersion: 3 }),
    situationCodes: ["SIT-001", "SIT-002", "SIT-003", "SIT-004", "SIT-005", "SIT-006"],
    stageIndex: 2, phase: "rolled", dice: [1, 4, 5], pressure: 0,
    care: createKqCareState(), xp: 7, ...overrides,
  };
}

describe("conditional validation preview", () => {
  it("explains why two successes out of two remain fragile with an unprotected Danger", () => {
    const state = position();
    const preview = getKqTurnPreview(state)!;
    expect(preview).toMatchObject({ outcome: "fragile", dangerBlocksSuccess: true, dangers: 1,
      qualityDelta: 1, xpGain: 1, xpAfter: 8, pressure: { before: 0, after: 1 } });
    expect(getKqTurnPreview({ ...state, cancelledDangers: 1 })).toMatchObject({
      outcome: "success", dangerBlocksSuccess: false, dangers: 0, pressure: { after: 0 },
    });
  });

  it("announces health death or the one first-culture rescue before validation", () => {
    const state = position({ dice: [2, 2, 2], care: { ...createKqCareState(), vitality: 10 } });
    expect(getKqTurnPreview(state)).toMatchObject({ dead: true, rescued: false, health: { before: 10, after: 0 } });
    expect(getKqTurnPreview({ ...state, firstCultureRescue: true })).toMatchObject({
      dead: false, rescued: true, outcome: "failure", health: { before: 10, after: 15 },
    });
    const rescueUsed = resolveKqStage({ ...state, firstCultureRescue: true });
    expect(getKqTurnPreview({ ...state, firstCultureRescue: true, history: rescueUsed.history })).toMatchObject({
      dead: true, rescued: false,
    });
  });

  it("recalculates the actual same-stage care effect without exposing diagnoses", () => {
    const state = position({ dice: [2, 2, 2], care: { ...createKqCareState(), vitality: 50,
      problems: [{ code: "APHIDS", severity: 2, status: "suspected", trend: "stable", appearedAt: 2, variant: 0 }],
    } });
    expect(getKqTurnPreview(state)?.health).toEqual({ before: 50, after: 28 });
    const cared = getKqTurnPreview(performKqBasicCare(state))!;
    expect(cared.health).toEqual({ before: 50, after: 33 });
    expect(cared).not.toHaveProperty("problems");
    expect(JSON.stringify(cared)).not.toMatch(/APHIDS|pucerons|suspected/);
  });

  it("includes automatic Heritage recovery and does not claim a failed outcome", () => {
    const state = position({ dice: [2, 2, 2], heritageCode: "HERITAGE-006", heritageUsed: false });
    expect(getKqTurnPreview(state)).toMatchObject({ outcome: "success", diceOutcome: "failure",
      qualityDelta: 2, xpGain: 2, heritage: { name: "Reprise vigoureuse", changesOutcome: true } });
    expect(getKqTurnPreview({ ...state, heritageUsed: true })).toMatchObject({ outcome: "failure", heritage: null });
    expect(getKqTurnPreview({ ...state, stageIndex: 5, heritageEffect: "drying-fragile-to-success",
      heritageName: "Dernier affinage" })).toMatchObject({ outcome: "success", heritage: { name: "Dernier affinage", changesOutcome: true } });
  });

  it("uses resolved pressure including Heritage relief and the zero floor", () => {
    const state = position({ dice: [4, 5, 6], pressure: 2, heritageCode: "HERITAGE-099",
      heritageEffect: "spark-pressure-relief", heritageUsed: false });
    expect(getKqTurnPreview(state)).toMatchObject({ outcome: "critical", xpGain: 4,
      pressure: { before: 2, after: 0 }, heritage: { changesOutcome: false } });
    expect(getKqTurnPreview(position({ dice: [6, 6, 6], pressure: 0 }))).toMatchObject({
      pressure: { before: 0, after: 0 }, xpGain: 6,
    });
  });

  it("never predicts unrolled dice, future steps or a random reaction", () => {
    const state = position();
    for (const phase of ["prepare", "resolved", "complete"] as const) {
      expect(getKqTurnPreview({ ...state, phase })).toBeNull();
    }
    expect(getKqTurnPreview({ ...state, dice: null })).toBeNull();
    const before = structuredClone(state);
    const preview = getKqTurnPreview(state);
    expect(getKqTurnPreview(state)).toEqual(preview);
    expect(state).toEqual(before);
    expect(getKqTurnPreview({ ...state, seed: 548, rollNonce: 27,
      situationCodes: [...state.situationCodes.slice(0, 3), "SIT-024", "SIT-027", "SIT-012"],
    })).toEqual(preview);
    expect(preview).not.toHaveProperty("dice");
    expect(preview).not.toHaveProperty("completedAt");
  });

  it("keeps historical rules and does not invent a health value for them", () => {
    const state = position({ rulesVersion: 2, care: undefined, dice: [2, 2, 2] });
    const previous = resolveKqStage(state);
    expect(getKqTurnPreview({ ...state, history: previous.history })).toMatchObject({ dead: true, health: null });
    expect(getKqTurnPreview({ ...state, history: previous.history, firstCultureRescue: true })).toMatchObject({
      dead: false, rescued: true, health: null,
    });
  });

  it("keeps secondary figures collapsed while exposing death and the conditional label", () => {
    const preview = getKqTurnPreview(position({ dice: [2, 2, 2], care: { ...createKqCareState(), vitality: 10 } }))!;
    const html = renderToStaticMarkup(createElement(KqTurnPreview, { preview }));
    expect(html).toContain("Si tu valides maintenant");
    expect(html).toContain("La culture sera perdue, sans récolte.");
    expect(html).toContain("<summary>Qualité, XP et pression</summary>");
    expect(html).not.toMatch(/<details[^>]*\bopen(?:[=>\s])/);
    expect(html).not.toContain("<button");
  });
});

describe("pressure target presentation", () => {
  it("shows the actual capped target instead of promising an impossible extra success", () => {
    const state = position({ pressure: 4, situationCodes: ["SIT-001", "SIT-002", "SIT-013", "SIT-004", "SIT-005", "SIT-006"] });
    expect(getKqPressureHint(state)).toBe("Sous tension · 3 réussites requises (plafond)");
    expect(getKqPressureHint(state)).not.toContain("+1");
    expect(getKqPressureHint(position({ stageIndex: 0, pressure: 3 }))).toBe("Sous tension · 2 réussites requises");
    expect(getKqPressureHint(position({ pressure: 2 }))).toBe("Culture stable · tension à partir de 3");
  });
});
