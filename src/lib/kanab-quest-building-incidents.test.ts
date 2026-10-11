import { describe, expect, it } from "vitest";
import { KQ_STARTING_EQUIPMENT_CODES } from "./kanab-quest-equipment";
import { getKqEffectiveTentProfiles } from "./kanab-quest-production";
import { advanceKqStage, getKqBuildingHarvestLosses, getKqHarvestBreakdown, resolveKqStage, rollKqDice, startKqGame, type KqGameState } from "./kanab-quest-game";
import { createKqIntegrityCode, encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";
import { getKqCultureAnalysis } from "./kanab-quest-culture-analysis";

function start(units = 5, scope: "building" | "tent" = "building", rulesVersion: 2 | 3 = 2) {
  const tents = getKqEffectiveTentProfiles({ equipmentScopeVersion: 3,
    tents: Array.from({ length: units }, (_, index) => ({ tentNumber: index + 1, cultureOperationalCodes: [...KQ_STARTING_EQUIPMENT_CODES], levels: {} })),
    buildings: [{ buildingNumber: 1, cultureOperationalCodes: ["SECURITY-CAMERA", "SOLAR-BACKUP"], levels: { "SECURITY-CAMERA": 1, "SOLAR-BACKUP": 1 } }],
  });
  const state = startKqGame(303, { rulesVersion, equipmentScope: scope, equipmentTents: tents, equipmentShared: { codes: [], levels: {} }, energyMode: "balanced" });
  state.situationCodes = ["SIT-001", "SIT-008", "SIT-021", "SIT-004", "SIT-027", "SIT-006"];
  return state;
}

function atStage(index: number, state = start()) {
  while (state.stageIndex < index) state = advanceKqStage(resolveKqStage({ ...state, phase: "rolled", dice: [4, 4, 4] }));
  return { ...state, phase: "rolled" as const, dice: [1, 2, 4] as [number, number, number] };
}

describe("incidents confined to their building", () => {
  it.each([5, 6, 7, 8])("retains the first building's theft protection after expansion to %i tents", units => {
    const state = resolveKqStage(atStage(4, start(units)));
    expect(state.history[4].buildingHarvestLosses).toEqual({ 1: 0, 2: 35 });
    expect(state.harvestLossPercent).toBe(Math.round(35 * (units - 4) / units * 100) / 100);
    const tents = getKqHarvestBreakdown(state).tentHarvests!;
    expect(tents.slice(0, 4).every(tent => tent.afterLossHarvestGrams === tent.grossHarvestGrams)).toBe(true);
    for (const tent of tents.slice(4)) expect(tent.afterLossHarvestGrams).toBe(Math.round(tent.grossHarvestGrams * 0.65 * 10) / 10);
    expect(state.effectNotices).toContain("Entrepôt 1 : aucune perte liée au vol, protection active.");
    expect(parseKqGameSave(encodeKqSave(state))).toEqual(state);
  });

  it("turns a partial outage into a local ten-point yield loss without changing the next dice", () => {
    const state = resolveKqStage(atStage(2));
    expect(state.powerOutage).toBe(false);
    expect(state.history[2].buildingHarvestLosses).toEqual({ 1: 0, 2: 10 });
    expect(state.harvestLossPercent).toBe(2);
    const tents = getKqHarvestBreakdown(state).tentHarvests!;
    expect(tents.slice(0, 4).every(tent => tent.afterLossHarvestGrams === tent.grossHarvestGrams)).toBe(true);
    expect(tents[4].afterLossHarvestGrams).toBe(Math.round(tents[4].grossHarvestGrams * 0.9 * 10) / 10);
    const next = advanceKqStage(state);
    const rolled = rollKqDice(next);
    expect(rolled.dice).toEqual(rollKqDice({ ...next, powerOutage: false }).dice);
    expect(rolled.effectNotices?.some(notice => notice.includes("Coupure de courant"))).toBe(false);
    expect(state.effectNotices?.some(notice => notice.includes("Entrepôt 2") && notice.includes("Aucun dé pénalisé"))).toBe(true);
    expect(parseKqGameSave(encodeKqSave(state))).toEqual(state);
  });

  it("keeps fully protected buildings intact and whole-culture cards effective", () => {
    const protectedState = resolveKqStage(atStage(2, start(4)));
    expect(protectedState.harvestLossPercent).toBe(0);
    expect(protectedState.powerOutage).toBe(false);
    const theft = atStage(4);
    const guarded = resolveKqStage({ ...theft, playedThisStage: ["BOTTE-034"] });
    expect(guarded.history[4].buildingHarvestLosses).toEqual({ 1: 0, 2: 0 });
    expect(guarded.harvestLossPercent).toBe(0);
  });

  it("accumulates local incidents, round-trips decimal averages and replays every decision", () => {
    let state = start(6, "building", 3);
    while (state.phase !== "complete") {
      const incident = state.stageIndex === 2 || state.stageIndex === 4;
      state = resolveKqStage({ ...state, phase: "rolled", dice: incident ? [1, 2, 4] : [4, 4, 4] });
      const restored = parseKqGameSave(encodeKqSave(state));
      expect(restored).toEqual(state);
      if (state.phase !== "complete") {
        const next = advanceKqStage(state);
        expect(advanceKqStage({ ...restored!, completedAt: next.completedAt })).toEqual(next);
        state = next;
      }
    }
    expect(getKqBuildingHarvestLosses(state)).toEqual({ 1: 0, 2: 45 });
    expect(state.harvestLossPercent).toBe(15);
    expect(state.history[2].harvestLossPercent).toBe(3.33);
    expect(state.history[4].harvestLossPercent).toBe(11.67);
    const analysis = getKqCultureAnalysis(state);
    expect(analysis.coverage).toBe("detailed");
    expect(analysis.stages[2].evidence.some(text => text.includes("Entrepôt 2 : la coupure"))).toBe(true);
    expect(analysis.stages[2].evidence.some(text => text.includes("le vol"))).toBe(false);
    const tampered = structuredClone(state);
    tampered.history[2].buildingHarvestLosses![1] = 10;
    expect(createKqIntegrityCode(tampered)).not.toBe(createKqIntegrityCode(state));
  });

  it.each([
    (state: KqGameState) => { state.history[4].buildingHarvestLosses![1] = 35; },
    (state: KqGameState) => { state.history[4].buildingHarvestLosses![2] = 0; state.harvestLossPercent = 0; state.history[4].harvestLossPercent = 0; },
    (state: KqGameState) => { state.history[4].buildingHarvestLosses![3] = 35; },
    (state: KqGameState) => { delete state.history[4].buildingHarvestLosses; },
    (state: KqGameState) => { state.harvestLossPercent = 35; },
    (state: KqGameState) => { state.powerOutage = true; },
  ])("rejects a forged local incident journal or aggregate (%#)", forge => {
    const state = resolveKqStage(atStage(4));
    forge(state);
    expect(parseKqGameSave(encodeKqSave(state))).toBeNull();
  });

  it("preserves the global incident mechanics and receipts of legacy tent runs", () => {
    const theft = resolveKqStage(atStage(4, start(5, "tent")));
    expect(theft.harvestLossPercent).toBe(35);
    expect(theft.history[4].buildingHarvestLosses).toBeUndefined();
    expect(getKqHarvestBreakdown(theft).tentHarvests!.every(tent => tent.afterLossHarvestGrams < tent.grossHarvestGrams)).toBe(true);
    expect(parseKqGameSave(encodeKqSave(theft))).toEqual(theft);
    const power = resolveKqStage(atStage(2, start(5, "tent")));
    expect(power.powerOutage).toBe(true);
    expect(power.harvestLossPercent).toBe(0);
    expect(power.history[2].buildingHarvestLosses).toBeUndefined();
    expect(parseKqGameSave(encodeKqSave(power))).toEqual(power);
  });
});
