import { describe, expect, it } from "vitest";
import {
  advanceKqStage, getKqStageTarget, KQ_BUDDIES, KQ_STAGES, previewKqResolution,
  resolveKqStage, rollKqDice, startKqGame, type KqGameState,
} from "./kanab-quest-game";
import { encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";
import { createKqWarehouseStarter, getKqWarehouseQuote, getKqWarehouseRunSnapshot } from "./kanab-quest-warehouse";

function cultures(codes: string[], seed = 300) {
  const starter = createKqWarehouseStarter();
  const warehouse = getKqWarehouseQuote({ ...starter, zones: codes.map((buddieCode, index) => ({
    ...starter.zones[0], id: `culture-${index}`, buddieCode,
    x: index % 10, y: Math.floor(index / 10),
  })) }, starter).nextState;
  return codes.map((varietyCode, index) => startKqGame(seed, {
    varietyCode, deckCodes: [],
    warehouse: getKqWarehouseRunSnapshot(warehouse, 4, `culture-${index}`),
  }));
}

function step(state: KqGameState) {
  return advanceKqStage(resolveKqStage(rollKqDice(state)));
}

describe("the same dice game in every independent culture", () => {
  it("lets all 52 Buddies roll, resolve and advance under the same rules", () => {
    const states = cultures(KQ_BUDDIES.map(buddie => buddie.code));
    const reference = rollKqDice(states[0]);
    expect(states).toHaveLength(52);
    for (const [index, state] of states.entries()) {
      expect(state).toMatchObject({
        rulesVersion: 3, phase: "prepare", varietyCode: KQ_BUDDIES[index].code,
        warehouse: { version: 2, zoneId: `culture-${index}` },
      });
      const rolled = rollKqDice(state);
      expect(rolled.phase).toBe("rolled");
      // Equal seeds and choices make the rule comparison deterministic;
      // separate official cultures still receive their own server seed.
      expect(rolled.dice).toEqual(reference.dice);
      expect(getKqStageTarget(rolled)).toBe(getKqStageTarget(reference));
      expect(previewKqResolution(rolled)).toEqual(previewKqResolution(reference));
      const resolved = resolveKqStage(rolled);
      expect(resolved.phase).toBe("resolved");
      expect(resolved.history).toHaveLength(1);
      expect(advanceKqStage(resolved)).toMatchObject({
        phase: "prepare", stageIndex: 1, varietyCode: state.varietyCode,
        warehouse: { version: 2, zoneId: `culture-${index}` },
      });
    }
  });

  it("keeps a culture untouched while another Buddie's zone plays a turn", () => {
    const [first, second] = cultures(["HH2026-001", "HH2026-052"]);
    const firstBefore = structuredClone(first), secondBefore = structuredClone(second);
    const firstAfter = step(first);
    expect(firstAfter.stageIndex).toBe(1);
    expect(firstAfter.warehouse?.zoneId).toBe("culture-0");
    expect(first).toEqual(firstBefore);
    expect(second).toEqual(secondBefore);
    expect(second).toMatchObject({ phase: "prepare", stageIndex: 0, dice: null, history: [] });

    const secondAfter = step(second);
    expect(secondAfter.stageIndex).toBe(1);
    expect(secondAfter.warehouse?.zoneId).toBe("culture-1");
    expect(secondAfter.history[0]).toMatchObject({
      dice: firstAfter.history[0].dice, target: firstAfter.history[0].target,
      total: firstAfter.history[0].total, outcome: firstAfter.history[0].outcome,
      xpGain: firstAfter.history[0].xpGain, qualityDelta: firstAfter.history[0].qualityDelta,
    });
    expect(first.xp).toBeGreaterThan(second.xp);
    expect(secondAfter.xp - second.xp).toBe(firstAfter.xp - first.xp);
    expect(firstAfter.varietyCode).toBe("HH2026-001");
    expect(secondAfter.varietyCode).toBe("HH2026-052");
    expect(parseKqGameSave(encodeKqSave(firstAfter))).toEqual(firstAfter);
    expect(parseKqGameSave(encodeKqSave(secondAfter))).toEqual(secondAfter);
  });

  it("plays a culture to completion without advancing the other Buddie's zone", () => {
    const [first, second] = cultures(["HH2026-020", "HH2026-040"]);
    const untouched = structuredClone(second);
    let completed = first;
    for (let stage = 0; stage < KQ_STAGES.length && completed.phase !== "complete"; stage++) {
      completed = step(completed);
    }
    expect(completed.phase).toBe("complete");
    expect(completed.history.length).toBeGreaterThan(0);
    expect(completed.warehouse).toEqual(first.warehouse);
    expect(completed.varietyCode).toBe(first.varietyCode);
    expect(second).toEqual(untouched);
    expect(step(second)).toMatchObject({ stageIndex: 1, varietyCode: second.varietyCode });
    expect(parseKqGameSave(encodeKqSave(completed))).toEqual(completed);
  });
});
