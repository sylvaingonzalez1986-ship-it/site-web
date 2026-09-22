import { describe, expect, it } from "vitest";
import {
  activateKqHeritage, advanceKqStage, getKqHarvestBreakdown, getKqRunProjection,
  getKqZeroSuccessStageCount, isKqCultureDead, KQ_SITUATIONS, KQ_STAGES,
  playKqCard, previewKqResolution, redrawKqHand, resolveKqStage, rollKqDice,
  startKqGame, type KqGameState,
} from "./kanab-quest-game";
import { createKqFlower } from "./kanab-quest-battle";
import { encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";

const resolveDice = (state: KqGameState, dice: [number, number, number]) =>
  resolveKqStage({ ...state, phase: "rolled", dice });

function firstZero() {
  return resolveDice(startKqGame(300, { equipmentCodes: ["TENT-120", "LED-300", "AIR-EC6"] }), [2, 2, 3]);
}

function deadCulture() {
  return resolveDice(advanceKqStage(firstZero()), [1, 2, 3]);
}

describe("culture death after two stages without successes", () => {
  it("keeps the first zero playable and ends immediately on the second", () => {
    const first = firstZero();
    expect(first.phase).toBe("resolved");
    expect(getKqZeroSuccessStageCount(first)).toBe(1);
    expect(isKqCultureDead(first)).toBe(false);
    const dead = resolveDice(advanceKqStage(first), [1, 2, 3]);
    expect(dead).toMatchObject({ phase: "complete", cultureDead: true, harvestGrams: 0, equipmentQualityBonus: 0, stageIndex: 1 });
    expect(dead.history).toHaveLength(2);
    expect(dead.history.at(-1)?.total).toBe(0);
    expect(dead.completedAt).toBeDefined();
    expect(dead.effectNotices?.at(-1)).toContain("Culture morte");
  });

  it("counts zeros even when successful stages separate them", () => {
    const success = resolveDice(advanceKqStage(firstZero()), [4, 5, 6]);
    expect(success.history.at(-1)?.outcome).toBe("critical");
    const dead = resolveDice(advanceKqStage(success), [2, 3, 3]);
    expect(isKqCultureDead(dead)).toBe(true);
    expect(dead.history.map(entry => entry.total)).toEqual([0, 3, 0]);
  });

  it("also kills the culture if the second zero occurs during the final stage", () => {
    let state = advanceKqStage(firstZero());
    while (state.stageIndex < KQ_STAGES.length - 1) {
      state = advanceKqStage(resolveDice(state, [4, 5, 6]));
    }
    const dead = resolveDice(state, [2, 2, 3]);
    expect(dead.history).toHaveLength(6);
    expect(dead).toMatchObject({ phase: "complete", cultureDead: true, harvestGrams: 0 });
  });

  it("does not count an ordinary failure that has a success", () => {
    const next = advanceKqStage(firstZero());
    const difficult = KQ_SITUATIONS.find(situation => situation.stage === KQ_STAGES[next.stageIndex] && situation.difficulty >= 2)!;
    const situationCodes = [...next.situationCodes];
    situationCodes[next.stageIndex] = difficult.code;
    const resolved = resolveDice({ ...next, situationCodes, pressure: 3 }, [1, 2, 4]);
    expect(resolved.history.at(-1)).toMatchObject({ total: 1, outcome: "failure" });
    expect(getKqZeroSuccessStageCount(resolved)).toBe(1);
    expect(resolved.phase).toBe("resolved");
  });

  it("lets a reaction save a second zero before its validation", () => {
    const base = startKqGame(301, { heritageCard: {
      code: "HERITAGE-900", name: "Étincelle de secours", timing: "once-per-run", effect: "neutral-to-spark",
      description: "Transforme un neutre en Étincelle.", producerName: "Test",
    } });
    const first = resolveDice(base, [1, 2, 3]);
    const rolled: KqGameState = { ...advanceKqStage(first), phase: "rolled", dice: [2, 2, 3] };
    expect(previewKqResolution(rolled)?.total).toBe(0);
    expect(isKqCultureDead(rolled)).toBe(false);
    const rescued = resolveKqStage(activateKqHeritage(rolled));
    expect(rescued.history.at(-1)?.total).toBe(1);
    expect(rescued.phase).toBe("resolved");
    expect(isKqCultureDead(rescued)).toBe(false);
  });

  it("counts real successes even if an Heritage changes failure into fragile", () => {
    const base = startKqGame(302, { heritageCard: {
      code: "HERITAGE-900", name: "Reprise vigoureuse", timing: "passive", effect: "failure-to-fragile",
      description: "Le premier échec devient fragile.", producerName: "Test",
    } });
    const first = resolveDice(base, [2, 2, 3]);
    expect(first.history[0]).toMatchObject({ total: 0, outcome: "fragile" });
    expect(isKqCultureDead(resolveDice(advanceKqStage(first), [2, 2, 3]))).toBe(true);
  });

  it("cannot resume, replay a resolution, consume cards or create a flower after death", () => {
    const dead = deadCulture();
    expect(advanceKqStage(dead)).toBe(dead);
    expect(resolveKqStage(dead)).toBe(dead);
    expect(rollKqDice(dead)).toBe(dead);
    expect(playKqCard(dead, "BOTTE-005")).toBe(dead);
    expect(activateKqHeritage(dead)).toBe(dead);
    expect(redrawKqHand(dead)).toBe(dead);
    expect(() => createKqFlower(dead)).toThrow("culture morte");
  });

  it("reports no remaining stages, projected yield or equipment bonus after death", () => {
    const dead = deadCulture();
    expect(getKqRunProjection(dead)).toMatchObject({ tier: "Culture morte", harvestGrams: 0, remainingStages: 0, equipmentQualityBonus: 0, nextTier: null });
    expect(getKqHarvestBreakdown(dead)).toMatchObject({ grossHarvestGrams: 0, finalHarvestGrams: 0, energyAdjustmentGrams: 0, equipmentQualityBonus: 0 });
    expect(getKqRunProjection({ ...dead, harvestGrams: undefined }).harvestGrams).toBe(0);
  });

  it("round-trips an early death and rejects inconsistent death saves", () => {
    const dead = deadCulture();
    expect(parseKqGameSave(encodeKqSave(dead))).toEqual(dead);
    for (const invalid of [
      { ...dead, phase: "prepare" }, { ...dead, harvestGrams: 100 },
      { ...dead, cultureDead: "true" }, { ...dead, history: dead.history.slice(0, 1) },
      { ...dead, history: dead.history.map(entry => ({ ...entry, total: 1 })) },
    ]) expect(parseKqGameSave(encodeKqSave(invalid))).toBeNull();
  });

  it("closes an old resolved active save with two zeros, without changing completed old harvests", () => {
    const dead = deadCulture();
    const active: KqGameState = { ...dead, phase: "resolved", cultureDead: undefined, harvestGrams: undefined, completedAt: undefined };
    expect(isKqCultureDead(advanceKqStage(active))).toBe(true);
    const oldHarvest: KqGameState = { ...dead, cultureDead: undefined, harvestGrams: 50 };
    expect(isKqCultureDead(oldHarvest)).toBe(false);
    expect(advanceKqStage(oldHarvest)).toBe(oldHarvest);
    expect(getKqRunProjection(oldHarvest).harvestGrams).toBe(50);
  });

  it("reaches a normal harvest with at most one zero", () => {
    let state = advanceKqStage(firstZero());
    while (state.phase !== "complete") {
      state = advanceKqStage(resolveDice(state, [4, 5, 6]));
    }
    expect(state.history).toHaveLength(6);
    expect(isKqCultureDead(state)).toBe(false);
    expect(state.harvestGrams).toBeGreaterThan(0);
    expect(createKqFlower(state).status).toBe("available");
  });
});