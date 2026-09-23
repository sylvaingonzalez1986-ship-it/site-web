import { describe, expect, it } from "vitest";
import { quoteKqEnergy, type KqEnergyMode } from "./kanab-quest-energy";
import { advanceKqStage, getKqHarvestBreakdown, getKqRunProjection, resolveKqStage, startKqGame, type KqGameState } from "./kanab-quest-game";
import { createKqIntegrityCode, encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";
import { getKqMarketEquipmentGoal, getKqRoutePlanEquipmentGoal, quoteKqMarketRoutes } from "./kanab-quest-market";
import { buildKqEconomyBalanceReport, getKqEquipmentPaybackScenarios } from "./kanab-quest-economy-balance";

const equipmentCodes = ["TENT-120", "LED-300", "AIR-EC6", "SOLAR-BACKUP"];
const equipmentLevels = Object.fromEntries(equipmentCodes.map(code => [code, 7]));
const start = (productionUnits = 1, energyMode: KqEnergyMode = "balanced") => startKqGame(300, {
  equipmentCodes, equipmentLevels, energyMode, productionUnits,
});
const resolve = (state: KqGameState, dice: [number, number, number] = [4, 5, 6]) => resolveKqStage({ ...state, phase: "rolled", dice });
const complete = (initial: KqGameState) => {
  let state = initial;
  while (state.phase !== "complete") state = advanceKqStage(resolve(state));
  return state;
};

describe("production capacity through a complete culture", () => {
  it.each([2, 3, 4, 8])("scales every mode, invoice and harvest for %i units without changing quality", productionUnits => {
    for (const mode of ["eco", "balanced", "intensive"] as KqEnergyMode[]) {
      const unit = complete({ ...start(1, mode), harvestLossPercent: 37 });
      const fleet = complete({ ...start(productionUnits, mode), harvestLossPercent: 37 });
      expect(fleet.quality).toBe(unit.quality);
      expect(fleet.equipmentQualityBonus).toBe(unit.equipmentQualityBonus);
      expect(fleet.history).toEqual(unit.history);
      expect(fleet.harvestGrams).toBeCloseTo(unit.harvestGrams! * productionUnits, 1);
      expect(fleet.energy!.totalCents).toBe(unit.energy!.totalCents * productionUnits);
      expect(fleet.energy!.totalWattHours).toBe(unit.energy!.totalWattHours * productionUnits);
      expect(fleet.energy!.savingsCents).toBe(unit.energy!.savingsCents * productionUnits);
      expect(fleet.energy!.solarPercent).toBe(unit.energy!.solarPercent);
      fleet.energy!.lines.forEach((line, index) => {
        expect(line.wattHours).toBe(unit.energy!.lines[index].wattHours * productionUnits);
        expect(line.watts).toBe(unit.energy!.lines[index].watts * productionUnits);
      });
      const breakdown = getKqHarvestBreakdown(fleet);
      const unitBreakdown = getKqHarvestBreakdown(unit);
      for (const field of ["grossHarvestGrams", "lostHarvestGrams", "energyAdjustmentGrams", "finalHarvestGrams"] as const) {
        expect(breakdown[field]).toBeCloseTo(unitBreakdown[field] * productionUnits, 1);
      }
      expect(breakdown.grossHarvestGrams - breakdown.lostHarvestGrams + breakdown.energyAdjustmentGrams).toBeCloseTo(fleet.harvestGrams!, 1);
      expect(getKqRunProjection(fleet).harvestGrams).toBe(fleet.harvestGrams);
      expect(parseKqGameSave(encodeKqSave(fleet))).toEqual(fleet);
    }
  });

  it("preserves large harvests and the per-tent cap", () => {
    const unit = complete(start());
    const fleet = complete(start(8));
    expect(fleet.harvestGrams).toBeGreaterThan(500);
    expect(fleet.harvestGrams).toBeCloseTo(unit.harvestGrams! * 8, 1);
    expect(fleet.harvestGrams).toBeLessThanOrEqual(4_000);
    expect(parseKqGameSave(encodeKqSave({ ...fleet, harvestGrams: 4_000.1 }))).toBeNull();
  });

  it.each([2, 3, 4, 8])("keeps a dead culture at zero with its full %i-unit invoice", units => {
    const initial = start(units);
    const dead = resolve(advanceKqStage(resolve(initial, [2, 2, 3])), [2, 2, 3]);
    expect(dead.cultureDead).toBe(true);
    expect(dead.harvestGrams).toBe(0);
    expect(getKqRunProjection(dead).harvestGrams).toBe(0);
    expect(getKqHarvestBreakdown(dead).finalHarvestGrams).toBe(0);
    expect(dead.energy).toEqual(initial.energy);
    expect(parseKqGameSave(encodeKqSave(dead))).toEqual(dead);
  });

  it("keeps historical saves and rejects altered capacities or invoices", () => {
    const old = start();
    expect(old.equipment!.productionUnits).toBeUndefined();
    expect(old.energy!.productionUnits).toBeUndefined();
    expect(parseKqGameSave(encodeKqSave(old))).toEqual(old);
    const fleet = start(4);
    for (const units of [0, -1, 1.5, 5, 7, 9, "4", null]) {
      expect(parseKqGameSave(encodeKqSave({ ...fleet, equipment: { ...fleet.equipment, productionUnits: units } }))).toBeNull();
    }
    expect(parseKqGameSave(encodeKqSave({ ...fleet, energy: quoteKqEnergy(equipmentCodes, equipmentLevels, "balanced") }))).toBeNull();
    expect(parseKqGameSave(encodeKqSave({ ...old, energy: fleet.energy }))).toBeNull();
    expect(createKqIntegrityCode(start(2))).not.toBe(createKqIntegrityCode(start(4)));
  });
});

describe("large harvest commercial quotes", () => {
  it("preserves all 4,000 g when preparing a market lot or balance preview", () => {
    const raw = quoteKqMarketRoutes({ harvestGrams: 4_000, juryScore: 8.8, equipmentCodes }).find(q => q.route === "raw")!;
    expect(raw.processedInputGrams).toBe(4_000);
    expect(raw.productGrams).toBe(4_000);
    expect(buildKqEconomyBalanceReport({ harvestGrams: 4_000, juryScore: 8.8 }).harvestGrams).toBe(4_000);
  });

  it.each([2, 3, 4, 8])("scales purchase funding and payback costs for %i units", productionUnits => {
    const one = getKqEquipmentPaybackScenarios("PRESS-0600")[0];
    const fleet = getKqEquipmentPaybackScenarios("PRESS-0600", { productionUnits })[0];
    expect(fleet.acquisitionCostCents).toBe(one.acquisitionCostCents * productionUnits);
    expect(fleet.remainingInvestmentCents).toBe(one.remainingInvestmentCents * productionUnits);
    expect(fleet.payoutCents).toBeCloseTo(one.payoutCents * productionUnits, -1);
    expect(fleet.personalizedPaybackHarvests).toBeCloseTo(one.personalizedPaybackHarvests!, 1);
    const fixedHarvest = getKqEquipmentPaybackScenarios("PRESS-0600", { productionUnits, harvestGrams: 100 })[0];
    expect(fixedHarvest.payoutCents).toBe(one.payoutCents);
    const goal = getKqRoutePlanEquipmentGoal({ route: "dry-sift", ownedCodes: [], productionUnits })!;
    const singleGoal = getKqRoutePlanEquipmentGoal({ route: "dry-sift", ownedCodes: [] })!;
    expect(goal.equipmentPriceCents).toBe(singleGoal.equipmentPriceCents * productionUnits);
    const quote = quoteKqMarketRoutes({ juryScore: 8.8, harvestGrams: 100, equipmentCodes: [] }).find(q => q.route === "dry-sift")!;
    const marketGoal = getKqMarketEquipmentGoal({ quote, ownedCodes: [], equippedCodes: [], cashCents: singleGoal.equipmentPriceCents, productionUnits })!;
    expect(marketGoal.priceCents).toBe(goal.equipmentPriceCents);
    expect(marketGoal.affordable).toBe(false);
    expect(marketGoal.remainingCents).toBe(singleGoal.equipmentPriceCents * (productionUnits - 1));
  });
});
