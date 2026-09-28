import { describe, expect, it } from "vitest";
import { summarizeKqEquipmentLoadout } from "./kanab-quest-equipment";
import { quoteKqEnergy, quoteKqTentEnergy, applyKqEnergyHarvest, type KqEnergyMode } from "./kanab-quest-energy";
import { advanceKqStage, getKqHarvestBreakdown, getKqRunProjection, resolveKqStage, startKqGame, type KqGameState } from "./kanab-quest-game";
import { createKqIntegrityCode, encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";
import { getKqMarketEquipmentGoal, getKqRoutePlanEquipmentGoal, quoteKqMarketRoutes, calculateKqHarvestGrams, calculateKqEquipmentQualityBonus } from "./kanab-quest-market";
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

describe("independently equipped tents with one common culture", () => {
  const starterCodes = ["TENT-080-STARTER", "LED-150-STARTER", "AIR-STARTER"];
  const starterLevels = Object.fromEntries(starterCodes.map(code => [code, 1]));
  const tents = () => [
    { tentNumber: 1, codes: [...equipmentCodes], levels: { ...equipmentLevels } },
    { tentNumber: 2, codes: [...starterCodes], levels: { ...starterLevels } },
  ];

  it("freezes distinct equipment and averages bonuses without copying upgraded equipment", () => {
    const input = tents();
    const mixed = startKqGame(300, { equipmentTents: input, energyMode: "balanced" });
    const upgraded = start();
    const basic = startKqGame(300, { equipmentCodes: starterCodes });
    expect(mixed.equipment!.productionUnits).toBe(2);
    expect(mixed.equipment!.tents![1]).toEqual(input[1]);
    expect(mixed.equipment!.codes).toEqual(upgraded.equipment!.codes);
    expect(mixed.equipment!.quantityPercent).toBe((upgraded.equipment!.quantityPercent + basic.equipment!.quantityPercent) / 2);
    expect(mixed.equipment!.qualityMaxBonus).toBe((upgraded.equipment!.qualityMaxBonus + basic.equipment!.qualityMaxBonus) / 2);
    expect(mixed.equipment!.powerWatts).toBe(upgraded.equipment!.powerWatts + basic.equipment!.powerWatts);
    expect(mixed.equipment!.unlocks).not.toContain("power-backup");
    input[0].levels["LED-300"] = 10;
    input[1].codes.push("SOLAR-BACKUP");
    expect(mixed.equipment!.tents![0].levels["LED-300"]).toBe(7);
    expect(mixed.equipment!.tents![1].codes).not.toContain("SOLAR-BACKUP");
    expect(parseKqGameSave(encodeKqSave(mixed))).toEqual(mixed);
  });

  it.each(["eco", "balanced", "intensive"] as KqEnergyMode[])("sums each tent's capped yield with shared quality in %s mode", mode => {
    const mixed = complete({ ...startKqGame(300, { equipmentTents: tents(), energyMode: mode }), harvestLossPercent: 37 });
    const one = complete(start(1, mode));
    const successfulStages = mixed.history.filter(entry => entry.outcome === "success" || entry.outcome === "critical").length;
    expect(mixed.situationCodes).toEqual(one.situationCodes);
    expect(mixed.history).toEqual(one.history);
    expect(mixed.equipmentQualityBonus).toBe(calculateKqEquipmentQualityBonus(mixed.equipment!.qualityMaxBonus, successfulStages));
    expect(mixed.quality).toBeLessThan(one.quality);
    const quantityBonuses = [start().equipment!.quantityPercent, startKqGame(300, { equipmentCodes: starterCodes }).equipment!.quantityPercent];
    const expectedHarvest = quantityBonuses.reduce((sum, quantityPercent) => {
      const gross = calculateKqHarvestGrams({ quality: mixed.quality, successfulStages, quantityPercent });
      return sum + applyKqEnergyHarvest(Math.round(gross * 0.63 * 10) / 10, mixed.energy);
    }, 0);
    expect(mixed.harvestGrams).toBeCloseTo(expectedHarvest, 1);
    expect(mixed.harvestGrams).toBeLessThan(one.harvestGrams! * 2);
    const breakdown = getKqHarvestBreakdown(mixed);
    expect(breakdown.grossHarvestGrams - breakdown.lostHarvestGrams + breakdown.energyAdjustmentGrams).toBeCloseTo(mixed.harvestGrams!, 1);
    expect(parseKqGameSave(encodeKqSave(mixed))).toEqual(mixed);
  });

  it("bills the starter load separately without extending the first tent's solar discount", () => {
    const mixed = quoteKqTentEnergy(tents());
    const upgraded = quoteKqEnergy(equipmentCodes, equipmentLevels);
    const basic = quoteKqEnergy(starterCodes, starterLevels);
    expect(mixed.totalCents).toBe(upgraded.totalCents + basic.totalCents);
    expect(mixed.totalWattHours).toBe(upgraded.totalWattHours + basic.totalWattHours);
    expect(mixed.savingsCents).toBe(upgraded.savingsCents);
    expect(mixed.solarPercent).toBeLessThan(upgraded.solarPercent);
    expect(mixed.lines.filter(line => line.tentNumber === 2).map(({ tentNumber, ...line }) => { void tentNumber; return line; })).toEqual(basic.lines);
  });

  it("rejects missing, duplicate and tampered tent snapshots and invoice attribution", () => {
    const state = startKqGame(300, { equipmentTents: tents(), energyMode: "balanced" });
    for (const invalidTents of [tents().slice(0, 1), [tents()[0], tents()[0]], [tents()[0], { ...tents()[1], tentNumber: 3 }], [tents()[0], { ...tents()[1], levels: {} }]]) {
      expect(parseKqGameSave(encodeKqSave({ ...state, equipment: { ...state.equipment, tents: invalidTents } }))).toBeNull();
    }
    const changed = tents();
    changed[1].codes.push("SOLAR-BACKUP");
    changed[1].levels["SOLAR-BACKUP"] = 10;
    expect(parseKqGameSave(encodeKqSave({ ...state, equipment: { ...state.equipment, tents: changed } }))).toBeNull();
    expect(parseKqGameSave(encodeKqSave({ ...state, energy: { ...state.energy, lines: state.energy!.lines.map(line => ({ ...line, tentNumber: 1 })) } }))).toBeNull();
    expect(createKqIntegrityCode(state)).not.toBe(createKqIntegrityCode({ ...state, equipment: { ...state.equipment!, tents: changed } }));
    const dead = resolve(advanceKqStage(resolve(state, [2, 2, 3])), [2, 2, 3]);
    expect(dead.harvestGrams).toBe(0);
    expect(dead.energy).toEqual(state.energy);
    expect(parseKqGameSave(encodeKqSave(dead))).toEqual(dead);
  });
});


describe("one installation serving every tent", () => {
  const cultureCodes = ["TENT-120", "LED-300", "AIR-EC6", "CLIMATE-SMART", "SOLAR-BACKUP", "SECURITY-CAMERA", "DRYING-ROOM"];
  const levels = Object.fromEntries(cultureCodes.map(code => [code, 3]));
  const processing = { codes: ["WASHER-25L", "FREEZE-DRYER"], levels: { "WASHER-25L": 2, "FREEZE-DRYER": 3 } };
  const installation = (productionUnits: number, mode: KqEnergyMode = "balanced") => startKqGame(300, {
    equipmentScope: "installation", equipmentCodes: [...cultureCodes], equipmentLevels: { ...levels },
    equipmentShared: processing, productionUnits, energyMode: mode,
  });

  it.each([2, 4, 8])("repeats culture appliances across %i tents but counts services and processing power once", units => {
    const state = installation(units);
    const single = installation(1);
    const replicatedCodes = cultureCodes.filter(code => !["SOLAR-BACKUP", "SECURITY-CAMERA", "DRYING-ROOM"].includes(code));
    const growingPower = summarizeKqEquipmentLoadout(replicatedCodes, levels).powerWatts;
    expect(state.equipment!.powerWatts).toBe(single.equipment!.powerWatts + growingPower * (units - 1));
    expect(state.equipment!.qualityMaxBonus).toBe(single.equipment!.qualityMaxBonus);
    expect(state.equipment!.quantityPercent).toBe(single.equipment!.quantityPercent);
    expect(state.equipment!.unlocks).toEqual(single.equipment!.unlocks);
    expect(state.equipment!.tents!.every(tent => JSON.stringify(tent.codes) === JSON.stringify(cultureCodes))).toBe(true);
    expect(state.equipment!.shared).toEqual(processing);
    for (const mode of ["eco", "balanced", "intensive"] as const) {
      const energy = installation(units, mode).energy!;
      const growing = quoteKqEnergy(cultureCodes.filter(code => !["SECURITY-CAMERA", "DRYING-ROOM"].includes(code)), levels, mode);
      const first = installation(1, mode).energy!;
      expect(energy.totalWattHours).toBe(first.totalWattHours + growing.totalWattHours * (units - 1));
      expect(energy.totalCents).toBe(first.totalCents + growing.totalCents * (units - 1));
      expect(energy.solarPercent).toBe(first.solarPercent);
      expect(energy.lines.filter(line => line.code === "SECURITY-CAMERA")).toHaveLength(1);
      expect(energy.lines.filter(line => line.code === "DRYING-ROOM")).toHaveLength(1);
      expect(energy.lines.filter(line => line.code === "LED-300")).toHaveLength(units);
    }
    const harvest = complete(state);
    const firstHarvest = complete(single);
    expect(harvest.harvestGrams).toBeCloseTo(firstHarvest.harvestGrams! * units, 1);
    expect(harvest.quality).toBe(firstHarvest.quality);
    expect(parseKqGameSave(encodeKqSave(harvest))).toEqual(harvest);
  });

  it("freezes the shared culture model without borrowing mutable arrays or levels", () => {
    const source = [{ tentNumber: 1, codes: [...cultureCodes], levels: { ...levels } }];
    const state = startKqGame(300, { equipmentScope: "installation", equipmentTents: source, equipmentShared: processing, productionUnits: 2 });
    source[0].levels["LED-300"] = 10;
    source[0].codes.length = 0;
    expect(state.equipment!.tents!.map(tent => tent.levels["LED-300"])).toEqual([3, 3]);
    expect(state.equipment!.tents![0].codes).toEqual(cultureCodes);
    expect(state.equipment!.tents![0].codes).not.toBe(state.equipment!.tents![1].codes);
    expect(state.equipment!.tents![0].levels).not.toBe(state.equipment!.tents![1].levels);
    expect(parseKqGameSave(encodeKqSave(state))).toEqual(state);
  });

  it("rejects altered scope, asymmetric installation profiles and service invoices while preserving legacy saves", () => {
    const current = installation(2);
    const asymmetric = structuredClone(current);
    asymmetric.equipment!.tents![1].levels["LED-300"] = 4;
    expect(parseKqGameSave(encodeKqSave(asymmetric))).toBeNull();
    expect(parseKqGameSave(encodeKqSave({ ...current, equipment: { ...current.equipment, scope: "tent" } }))).toBeNull();
    const missingFlag = structuredClone(current);
    delete missingFlag.equipment!.scope;
    expect(parseKqGameSave(encodeKqSave(missingFlag))).toBeNull();
    expect(createKqIntegrityCode(missingFlag)).not.toBe(createKqIntegrityCode(current));
    const old = startKqGame(300, { productionUnits: 2, equipmentTents: current.equipment!.tents, equipmentShared: processing, energyMode: "balanced" });
    expect(old.equipment!.scope).toBeUndefined();
    expect(old.energy!.totalCents).toBeGreaterThan(current.energy!.totalCents);
    expect(parseKqGameSave(encodeKqSave(old))).toEqual(old);
    expect(parseKqGameSave(encodeKqSave({ ...current, energy: old.energy }))).toBeNull();
  });
});
