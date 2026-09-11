import { describe, expect, it } from "vitest";
import { quoteKqEnergy, isKqEnergyQuoteValid, previewKqEnergyPayment, type KqEnergyMode } from "./kanab-quest-energy";
import { startKqGame, rollKqDice, resolveKqStage, advanceKqStage, getKqHarvestBreakdown } from "./kanab-quest-game";
import { quoteKqMarketRoutes } from "./kanab-quest-market";
import { encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";
const starter = ["TENT-080-STARTER", "LED-150-STARTER", "AIR-STARTER"];
const installed = ["LED-300", "AIR-EC6", "CLIMATE-SMART", "SECURITY-CAMERA"];
const levels = Object.fromEntries(installed.map(code => [code, 10]));
describe("cycle electricity", () => {
  it("charges only installed culture appliances, once each", () => {
    const quote = quoteKqEnergy(starter);
    expect(quote.totalWattHours).toBe(20100);
    expect(quote.totalCents).toBe(603);
    expect(quoteKqEnergy([...starter, ...starter, "WASHER-25L", "PRESS-0600"]).totalCents).toBe(603);
    expect(quoteKqEnergy([]).totalCents).toBe(0);
  });
  it("preserves raw sales when replacing the starter tent", () => {
    const raw = quoteKqMarketRoutes({ juryScore: 8, harvestGrams: 100, equipmentCodes: ["TENT-120", ...installed] }).find(q => q.route === "raw");
    expect(raw?.available).toBe(true);
  });
  it("accounts for level usage and solar coverage", () => {
    expect(quoteKqEnergy(installed).totalCents).toBe(1377);
    expect(quoteKqEnergy(installed, levels).totalCents).toBe(2616);
    const solar = quoteKqEnergy([...installed, "SOLAR-BACKUP"], {...levels, "SOLAR-BACKUP": 10});
    expect(solar.solarPercent).toBe(38);
    expect(solar.totalCents).toBe(1622);
  });
  it("rejects altered quotes while accepting legacy saves", () => {
    const state = startKqGame(51, {equipmentCodes: starter, energyMode: "eco"});
    expect(parseKqGameSave(encodeKqSave(state))).toEqual(state);
    expect(parseKqGameSave(encodeKqSave(startKqGame(51)))).not.toBeNull();
    expect(isKqEnergyQuoteValid({...state.energy, totalCents: 0}, starter)).toBe(false);
    expect(parseKqGameSave(encodeKqSave({...state, energy: {...state.energy, mode: "intensive"}}))).toBeNull();
    expect(isKqEnergyQuoteValid({...state.energy, mode: "constructor"}, starter)).toBe(false);
  });
  it("freezes the invoice and reconciles harvest through all six stages", () => {
    for (const mode of ["eco", "balanced", "intensive"] as KqEnergyMode[]) {
      let state = startKqGame(212, { equipmentCodes: installed, equipmentLevels: levels, energyMode: mode });
      const quote = structuredClone(state.energy);
      while (state.phase !== "complete") {
        if (state.phase === "prepare") state = rollKqDice(state);
        if (state.phase === "rolled") state = resolveKqStage(state);
        if (state.phase === "resolved") state = advanceKqStage(state);
      }
      expect(state.energy).toEqual(quote);
      expect(state.history).toHaveLength(6);
      expect(parseKqGameSave(encodeKqSave(state))).not.toBeNull();
      const b = getKqHarvestBreakdown(state);
      expect(b.grossHarvestGrams - b.lostHarvestGrams + b.energyAdjustmentGrams).toBeCloseTo(state.harvestGrams!, 1);
      expect(b.energyAdjustmentGrams).toEqual(mode === "balanced" ? 0 : expect.any(Number));
    }
  });
  it("never collects more than half a sale or more than outstanding debt", () => {
    expect(previewKqEnergyPayment(1001, 2000)).toEqual({electricityPaidCents: 500, netPayoutCents: 501, electricityRemainingCents: 1500});
    expect(previewKqEnergyPayment(1001, 100)).toEqual({electricityPaidCents: 100, netPayoutCents: 901, electricityRemainingCents: 0});
    expect(previewKqEnergyPayment(1001, 0).netPayoutCents).toBe(1001);
  });
});
