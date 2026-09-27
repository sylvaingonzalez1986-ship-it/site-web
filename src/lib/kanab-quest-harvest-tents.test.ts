import { describe, expect, it } from "vitest";
import equipmentFixture from "@/test/fixtures/kq-asymmetric-tents.json";
import {
  advanceKqStage,
  getKqHarvestBreakdown,
  getKqRunProjection,
  KQ_STAGES,
  startKqGame,
  type KqGameState,
} from "./kanab-quest-game";
import { encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";
import type { KqEnergyMode } from "./kanab-quest-energy";

const tents = [1, 2].map(tentNumber => ({
  tentNumber,
  codes: equipmentFixture.loadouts.filter(row => row.tent_number === tentNumber).map(row => row.equipment_code),
  levels: Object.fromEntries(equipmentFixture.owned.filter(row => row.tent_number === tentNumber).map(row => [row.equipment_code, row.level])),
}));

// Anonymous reproduction of a completed culture: four successful stages,
// one theft costing 35%, and an acceptable drying stage. No player identifiers.
function beforeCompletion(mode: KqEnergyMode = "balanced"): KqGameState {
  const outcomes = ["success", "success", "success", "success", "failure", "fragile"] as const;
  return {
    ...startKqGame(61255, { equipmentTents: tents, productionUnits: 2, energyMode: mode }),
    phase: "resolved",
    stageIndex: 5,
    quality: 8,
    harvestLossPercent: 35,
    history: KQ_STAGES.map((stage, index) => ({
      stage,
      situation: "Situation de test",
      dice: index === 4 ? [2, 1, 2] : [3, 4, 5],
      total: index === 4 ? 0 : index === 5 ? 1 : 2,
      target: 2,
      outcome: outcomes[index],
      qualityDelta: index === 4 ? -1 : index === 5 ? 1 : 2,
      xpGain: 1,
      pressureAfter: 0,
      harvestLossPercent: index === 4 ? 35 : 0,
      dangers: index === 4 ? 1 : 0,
      sparks: 0,
      combos: [],
      trait: "Résultat de test",
    })),
  };
}

describe("harvest contributions from each tent", () => {
  it("explains the exact 257.6 g receipt without changing its calculation or quality", () => {
    const before = beforeCompletion();
    const completed = advanceKqStage(before);
    const breakdown = getKqHarvestBreakdown(completed);

    expect(getKqRunProjection(before).harvestGrams).toBe(257.6);
    expect(completed).toMatchObject({ phase: "complete", quality: 12, equipmentQualityBonus: 4, harvestGrams: 257.6 });
    expect(breakdown).toMatchObject({
      stageQuality: 8, finalQuality: 12, grossHarvestGrams: 396.3,
      lostHarvestGrams: 138.7, harvestLossPercent: 35,
      energyAdjustmentGrams: 0, finalHarvestGrams: 257.6,
      tentHarvests: [
        { tentNumber: 1, quantityPercent: 133, grossHarvestGrams: 277.3, afterLossHarvestGrams: 180.2, finalHarvestGrams: 180.2 },
        { tentNumber: 2, quantityPercent: 0, grossHarvestGrams: 119, afterLossHarvestGrams: 77.4, finalHarvestGrams: 77.4 },
      ],
    });
    expect(getKqHarvestBreakdown(before)).toEqual(breakdown);
    const restored = parseKqGameSave(encodeKqSave(completed));
    expect(restored).toEqual(completed);
    expect(getKqHarvestBreakdown(restored!)).toEqual(breakdown);
  });

  it.each(["eco", "balanced", "intensive"] as const)("keeps every %s energy adjustment inside each tent's existing rounded contribution", mode => {
    const completed = advanceKqStage(beforeCompletion(mode));
    const breakdown = getKqHarvestBreakdown(completed);
    const total = breakdown.tentHarvests!.reduce((sum, tent) => sum + tent.finalHarvestGrams, 0);
    expect(Math.round(total * 10) / 10).toBe(completed.harvestGrams);
    expect(breakdown.grossHarvestGrams - breakdown.lostHarvestGrams + breakdown.energyAdjustmentGrams).toBeCloseTo(completed.harvestGrams!, 1);
    expect(breakdown.tentHarvests!.map(tent => tent.afterLossHarvestGrams)).toEqual([180.2, 77.4]);
  });

  it("accounts for both different tents with no losses", () => {
    const completed = advanceKqStage({ ...beforeCompletion(), harvestLossPercent: 0 });
    const breakdown = getKqHarvestBreakdown(completed);
    expect(breakdown.finalHarvestGrams).toBe(396.3);
    expect(breakdown.lostHarvestGrams).toBe(0);
    expect(breakdown.tentHarvests!.map(tent => tent.finalHarvestGrams)).toEqual([277.3, 119]);
  });

  it.each([1, 2, 4])("supports legacy snapshots with %i identical tents", productionUnits => {
    const legacy = startKqGame(1, { productionUnits, equipmentCodes: ["TENT-120", "LED-300", "AIR-EC6"] });
    const breakdown = getKqHarvestBreakdown(legacy);
    expect(legacy.equipment?.tents).toBeUndefined();
    expect(breakdown.tentHarvests).toHaveLength(productionUnits);
    expect(breakdown.tentHarvests!.map(tent => tent.tentNumber)).toEqual(Array.from({ length: productionUnits }, (_, index) => index + 1));
    expect(breakdown.tentHarvests!.reduce((sum, tent) => sum + tent.finalHarvestGrams, 0)).toBeCloseTo(getKqRunProjection(legacy).harvestGrams, 1);
  });

  it("does not invent positive contributions for a dead culture", () => {
    const dead = { ...advanceKqStage(beforeCompletion()), cultureDead: true, harvestGrams: 0 };
    expect(getKqHarvestBreakdown(dead)).toMatchObject({ grossHarvestGrams: 0, finalHarvestGrams: 0, tentHarvests: [] });
  });

  it("preserves a historical receipt if its recorded amount differs from today's detail", () => {
    const archived = { ...advanceKqStage(beforeCompletion()), harvestGrams: 250 };
    expect(getKqHarvestBreakdown(archived)).toMatchObject({ finalHarvestGrams: 250, tentHarvests: null });
    expect(getKqRunProjection(archived).harvestGrams).toBe(250);
    expect(archived.harvestGrams).toBe(250);
  });
});
