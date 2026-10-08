import { describe, expect, it } from "vitest";
import {
  advanceKqStage, KQ_CARDS, playKqCard, resolveKqStage, rollKqDice, startKqGame,
  type KqGameState,
} from "./kanab-quest-game";
import { getKqCultureAnalysis, isKqStageDecision } from "./kanab-quest-culture-analysis";
import { createKqIntegrityCode, encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";

const support = ["BOTTE-024", "BOTTE-021", "BOTTE-030", "BOTTE-026", "BOTTE-016"];
function positionAt(index = 0, overrides: Partial<KqGameState> = {}): KqGameState {
  let state = startKqGame(42, { startingXp: 10, deckCodes: support });
  state.situationCodes = ["SIT-001", "SIT-008", "SIT-003", "SIT-004", "SIT-005", "SIT-006"];
  while (state.stageIndex < index) {
    state = advanceKqStage(resolveKqStage({ ...state, phase: "rolled", dice: [4, 4, 4] }));
  }
  return { ...state, phase: "rolled", dice: [1, 4, 4], handCodes: support, ...overrides };
}
function resolved(overrides: Partial<KqGameState> = {}, index = 0) {
  return resolveKqStage(positionAt(index, overrides));
}
function withoutDecisions(state: KqGameState): KqGameState {
  return { ...state, history: state.history.map(({ decision: _decision, ...receipt }) => {
    void _decision;
    return receipt;
  }) };
}

describe("culture decision receipts", () => {
  it("captures the position before validation without changing the game result or sharing arrays", () => {
    const position = positionAt();
    const before = structuredClone(position);
    const result = resolveKqStage(position);
    const d = result.history[0].decision!;
    expect(d).toMatchObject({ version: 1, xp: position.xp, quality: 0, pressure: 0, reactionPlayed: false, handCodes: support });
    expect(isKqStageDecision(d)).toBe(true);
    expect(result).toMatchObject({ quality: 1, xp: position.xp + 1, pressure: 1, phase: "resolved" });
    expect(position).toEqual(before);
    d.handCodes.pop();
    d.usedCards.push("BOTTE-024");
    expect(position.handCodes).toHaveLength(5);
    expect(position.usedCards).toEqual([]);
  });

  it("round-trips new receipts and keeps historical receipts and their integrity code unchanged", () => {
    const state = resolved();
    expect(parseKqGameSave(encodeKqSave(state))).toEqual(state);
    const old = withoutDecisions(state);
    const restored = parseKqGameSave(encodeKqSave(old))!;
    expect(restored).toEqual(old);
    expect(createKqIntegrityCode(restored)).toBe(createKqIntegrityCode(old));
    expect(createKqIntegrityCode(state)).not.toBe(createKqIntegrityCode(old));
    const modified = structuredClone(state);
    modified.history[0].decision!.xp++;
    expect(createKqIntegrityCode(modified)).not.toBe(createKqIntegrityCode(state));
  });

  it.each([
    { xp: -1 }, { reactionPlayed: "no" }, { handCodes: Array(11).fill("BOTTE-024") },
    { usedCards: Array(33).fill("BOTTE-024") }, { playedThisStage: Array(5).fill("BOTTE-024") },
    { revealedPest: "invented" }, { bonusDie: 8 }, { version: 2 }, { cancelledDangers: Infinity },
    { inventedInventory: { "BOTTE-024": 100 } },
  ])("discards malformed optional metadata without resetting progress (%j)", invalid => {
    const state = resolved();
    const bad = { ...state, history: [{ ...state.history[0], decision: { ...state.history[0].decision, ...invalid } }] };
    const restored = parseKqGameSave(encodeKqSave(bad));
    expect(restored).toEqual(withoutDecisions(state));
    expect(getKqCultureAnalysis(restored!).coverage).toBe("legacy");
  });

  it("refuses a reconstructed result that differs from the recorded reward", () => {
    const state = resolved();
    state.history[0].xpGain!++;
    const analysis = getKqCultureAnalysis(state);
    expect(analysis.coverage).toBe("legacy");
    expect(analysis.advice.every(item => !item.exactEffect)).toBe(true);
    expect(analysis.stages[0].xpGain).toBe(2);
  });
});

describe("exact local card comparisons", () => {
  it("compares water rescue using actual dice, costs and pressure, with no account-stock claim", () => {
    const state = resolved();
    const input = structuredClone(state);
    const analysis = getKqCultureAnalysis(state);
    const card = analysis.advice.find(item => item.code === "BOTTE-024")!;
    expect(analysis.coverage).toBe("detailed");
    expect(card).toMatchObject({ basis: "verified-position", xpCost: 1, timing: "after-roll", stageIndex: 0 });
    expect(card.exactEffect).toMatchObject({
      before: { dice: [1, 4, 4], outcome: "fragile", qualityDelta: 1, xpGain: 1, pressureAfter: 1 },
      after: { dice: [4, 4, 4], outcome: "critical", qualityDelta: 3, xpGain: 3, pressureAfter: 0 },
      xpBalanceDelta: 1,
    });
    expect(card.availability).toContain("stock n’a pas été enregistré");
    expect(card.condition).toContain("Ajoute 1 Pression");
    expect(analysis.stages[0].evidence.join(" ")).toContain("sans ces Dangers");
    expect(state).toEqual(input);
    expect(getKqCultureAnalysis(state)).toEqual(analysis);
  });

  it.each([
    { xp: 0 }, { handCodes: ["BOTTE-021"] }, { usedCards: ["BOTTE-024"] }, { reactionPlayed: true },
  ])("does not simulate a reaction forbidden by the recorded position (%j)", overrides => {
    const analysis = getKqCultureAnalysis(resolved(overrides));
    expect(analysis.advice.filter(item => item.basis === "verified-position")).toEqual([]);
  });

  it("uses a neutral-to-spark card rather than inventing a favorable reroll", () => {
    const state = resolved({ dice: [3, 4, 4], deckCodes: ["BOTTE-006", "BOTTE-021"], handCodes: ["BOTTE-006", "BOTTE-021"] });
    const analysis = getKqCultureAnalysis(state);
    expect(analysis.advice[0].code).toBe("BOTTE-021");
    expect(analysis.advice[0].exactEffect).toMatchObject({ before: { outcome: "success", xpGain: 2 }, after: { dice: [6, 4, 4], outcome: "critical", xpGain: 4 }, xpBalanceDelta: 0 });
    expect(analysis.advice.some(item => item.code === "BOTTE-006" && item.exactEffect)).toBe(false);
  });

  it("does not use deterministic random seeds to forecast a reroll", () => {
    const analysis = getKqCultureAnalysis(resolved({ deckCodes: ["BOTTE-006"], handCodes: ["BOTTE-006"], dice: [1, 2, 3] }));
    expect(analysis.advice.some(item => item.exactEffect)).toBe(false);
  });

  it("accounts for a new pressure threshold instead of claiming a successful electricity bypass", () => {
    const position = positionAt(2, { deckCodes: ["BOTTE-028"], handCodes: ["BOTTE-028"], pressure: 2, dice: [1, 1, 2] });
    position.situationCodes[2] = "SIT-021";
    const analysis = getKqCultureAnalysis(resolveKqStage(position));
    const bypass = analysis.advice.find(item => item.code === "BOTTE-028")!;
    expect(bypass.exactEffect).toMatchObject({
      before: { target: 2, outcome: "failure" },
      after: { target: 3, total: 2, outcome: "fragile", pressureAfter: 4 },
    });
  });

  it("requires an identified matching pest for exact PBI advice", () => {
    const base = positionAt(2, { handCodes: [], deckCodes: [], dice: [1, 4, 4] });
    const hidden = getKqCultureAnalysis(resolveKqStage(base));
    expect(hidden.advice.some(item => item.exactEffect)).toBe(false);
    expect(hidden.advice.some(item => item.code === "BOTTE-025" && item.basis === "next-run")).toBe(true);
    const identified = getKqCultureAnalysis(resolveKqStage({ ...base, revealedPest: "aphids" }));
    expect(identified.advice[0].basis).toBe("verified-position");
    expect(KQ_CARDS.find(card => card.code === identified.advice[0].code)?.targets).toContain("aphids");
  });
});

describe("explanations based on the played culture", () => {
  it("explains pressure only when it actually raised the threshold", () => {
    const analysis = getKqCultureAnalysis(resolved({ pressure: 3 }));
    expect(analysis.stages[0].evidence.join(" ")).toContain("seuil est passé de 1 à 2");
    const capped = positionAt(0, { pressure: 4 });
    capped.situationCodes[0] = "SIT-017";
    expect(getKqCultureAnalysis(resolveKqStage(capped)).stages[0].evidence.join(" ")).not.toContain("seuil est passé");
  });

  it("uses the result after Heritage, including its quality bonus", () => {
    const position = positionAt(0, {
      heritageCode: "HERITAGE-999", heritageName: "Mémoire du résultat fragile", heritageTiming: "passive",
      heritageEffect: "fragile-quality-boost", heritageUsed: false,
    });
    const analysis = getKqCultureAnalysis(resolveKqStage(position));
    expect(analysis.coverage).toBe("detailed");
    expect(analysis.stages[0].qualityDelta).toBe(2);
    expect(analysis.advice[0].exactEffect?.before.qualityDelta).toBe(2);
    expect(analysis.advice[0].exactEffect?.after.qualityDelta).toBe(3);
    const recovery = { ...position, heritageTiming: "once-per-run" as const, heritageEffect: "failure-to-fragile" as const, dice: [1, 2, 3] as [number, number, number] };
    const rescued = getKqCultureAnalysis(resolveKqStage(recovery));
    expect(rescued.coverage).toBe("detailed");
    expect(rescued.stages[0].evidence.join(" ")).toContain("transformé Échec en Fragile");
  });

  it("isolates an earned curing bonus without replaying or undoing the dice", () => {
    const initial = positionAt(5, { phase: "prepare", dice: null });
    const prepared = playKqCard(initial, "BOTTE-016");
    const analysis = getKqCultureAnalysis(resolveKqStage({ ...prepared, phase: "rolled", dice: [4, 4, 4] }));
    expect(analysis.coverage).toBe("detailed");
    expect(analysis.stages[5].qualityDelta).toBe(4);
    expect(analysis.stages[5].evidence.join(" ")).toContain("Séchage patient a ajouté +1 Qualité");
    expect(analysis.stages[5].playedCards).toEqual([{ code: "BOTTE-016", name: "Séchage patient", xpCost: 2 }]);
    expect(analysis.advice.some(item => item.code === "BOTTE-016")).toBe(false);
  });

  it("distinguishes a true quality loss from theft and proposes protection with timing and cost", () => {
    const position = positionAt(4, { dice: [1, 2, 3] });
    position.situationCodes[4] = "SIT-027";
    const analysis = getKqCultureAnalysis(resolveKqStage(position));
    expect(analysis.stages[4].qualityDelta).toBe(-1);
    expect(analysis.stages[4].harvestLossPercent).toBe(35);
    expect(analysis.headline).toContain("le vol a réduit le rendement de 35 %");
    expect(analysis.advice[0]).toMatchObject({ code: "BOTTE-034", timing: "before-roll", xpCost: 2, basis: "next-run" });
    expect(analysis.advice[0].condition).toContain("avant les dés");
    const protectedState = resolveKqStage({ ...position, playedThisStage: ["BOTTE-034"], usedCards: ["BOTTE-034"], preparationPlayed: true });
    expect(getKqCultureAnalysis(protectedState).stages[4].harvestLossPercent).toBe(0);
    expect(getKqCultureAnalysis(protectedState).headline).toContain("a coûté 1 Qualité");
  });

  it("preserves first-culture rescue and the real unrescued death counter", () => {
    let state = positionAt(0, { firstCultureRescue: true, dice: [1, 2, 3], handCodes: [] });
    state = advanceKqStage(resolveKqStage(state));
    state = advanceKqStage(resolveKqStage({ ...state, phase: "rolled", dice: [1, 2, 3] }));
    const saved = getKqCultureAnalysis(state);
    expect(saved.stages[1].rescued).toBe(true);
    expect(saved.stages[1].evidence.join(" ")).toContain("gains sont restés identiques");
    const dead = resolveKqStage({ ...state, phase: "rolled", dice: [1, 2, 3] });
    const analysis = getKqCultureAnalysis(dead);
    expect(analysis.coverage).toBe("detailed");
    expect(analysis.headline).toContain("2 étapes à zéro réussite non secourues");
    expect(dead.harvestGrams).toBe(0);
  });

  it("degrades mixed and historical games without inferring past XP, hands, or actions", () => {
    const state = resolved({ dice: [4, 4, 4] }, 2);
    delete state.history[0].decision;
    expect(getKqCultureAnalysis(state).coverage).toBe("partial");
    const legacy = getKqCultureAnalysis(withoutDecisions(state));
    expect(legacy.coverage).toBe("legacy");
    expect(legacy.stages.every(stage => stage.pressureBefore === null && stage.playedCards.length === 0)).toBe(true);
    expect(legacy.advice.every(item => item.basis === "next-run" && !item.exactEffect)).toBe(true);
    expect(legacy.evidence.join(" ")).toContain("aucun coup manqué n’est affirmé");
  });

  it("never fabricates reward deltas for the oldest receipts", () => {
    const state = withoutDecisions(resolved());
    delete state.history[0].qualityDelta;
    delete state.history[0].xpGain;
    const analysis = getKqCultureAnalysis(state);
    expect(analysis.stages[0].qualityDelta).toBeNull();
    expect(analysis.stages[0].xpGain).toBeNull();
    expect(analysis.headline).toContain("gains détaillés manquent");
  });

  it("can explain a naturally rolled complete game without altering it", () => {
    let state = startKqGame(87, { deckCodes: support, startingXp: 4 });
    while (state.phase !== "complete") {
      if (state.phase === "prepare") state = rollKqDice(state);
      if (state.phase === "rolled") state = resolveKqStage(state);
      if (state.phase === "resolved") state = advanceKqStage(state);
    }
    const before = structuredClone(state);
    const analysis = getKqCultureAnalysis(state);
    expect(analysis.coverage).toBe("detailed");
    expect(analysis.stages).toHaveLength(state.history.length);
    expect(analysis.advice.length).toBeLessThanOrEqual(2);
    expect(state).toEqual(before);
  });
});
