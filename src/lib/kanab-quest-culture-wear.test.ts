import { describe, expect, it } from "vitest";
import {
  getKqCultureEquipmentCondition,
  getKqCultureOperationalCodes,
  getKqCultureWearAmount,
  getKqCultureWearPreview,
  type KqCultureEquipmentCondition,
} from "./kanab-quest-culture-wear";
import { quoteKqEnergy, type KqEnergyMode } from "./kanab-quest-energy";
import { getKqEquipmentDefinition, KQ_STARTING_EQUIPMENT_CODES, summarizeKqEquipmentLoadout } from "./kanab-quest-equipment";
import { startKqGame } from "./kanab-quest-game";
import { quoteKqMarketRoutes } from "./kanab-quest-market";
import { encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";

function condition(code: string, wear = 0, level = 1): KqCultureEquipmentCondition {
  const result = getKqCultureEquipmentCondition(code, level, wear);
  if (!result) throw new Error(`Missing condition for ${code}`);
  return result;
}

describe("permanent culture equipment wear", () => {
  it("accelerates intensive use only below 30% condition and never wears past broken", () => {
    expect(getKqCultureWearPreview("LED-300", condition("LED-300", 70), "intensive"))
      .toMatchObject({ conditionBefore: 30, conditionAfter: 20, wearPercent: 10, accelerated: false });
    expect(getKqCultureWearPreview("LED-300", condition("LED-300", 71), "intensive"))
      .toMatchObject({ conditionBefore: 29, conditionAfter: 14, wearPercent: 15, accelerated: true });
    expect(getKqCultureWearPreview("LED-300", condition("LED-300", 96), "intensive"))
      .toMatchObject({ conditionAfter: 0, wearPercent: 4, cyclesRemaining: 1 });
    expect(getKqCultureWearPreview("LED-300", condition("LED-300", 100), "intensive"))
      .toMatchObject({ conditionAfter: 0, wearPercent: 0, cyclesRemaining: 0, wearCostCents: 0, accelerated: false });
  });

  it.each([
    ["eco", 50], ["balanced", 20], ["intensive", 10],
  ] as const)("forecasts the complete LED lifetime in %s, including late acceleration", (mode, cycles) => {
    expect(getKqCultureWearPreview("LED-300", condition("LED-300"), mode)?.cyclesRemaining).toBe(cycles);
  });

  it("keeps previous wear when switching modes and accelerates again when returning to intensive", () => {
    let wear = 70;
    for (const [mode, expectedWear] of [["eco", 72], ["balanced", 77], ["intensive", 92], ["eco", 94]] as const) {
      const preview = getKqCultureWearPreview("LED-300", condition("LED-300", wear), mode)!;
      wear += preview.wearPercent;
      expect(wear).toBe(expectedWear);
      expect(preview.conditionAfter).toBe(100 - expectedWear);
    }
  });

  it("prices the replacement at the retained level and rounds fractional cents upward", () => {
    expect(condition("LED-300", 100, 1).replacementCents).toBe(35_900);
    expect(condition("LED-300", 100, 10).replacementCents).toBe(68_210);
    expect(condition("SECURITY-CAMERA", 100, 10).replacementCents).toBe(13_299);
    expect(condition("LED-300", 0, 10).replacementCents).toBe(condition("LED-300", 100, 10).replacementCents);
  });

  it("keeps starter gear, the dog and processing machines outside culture replacements", () => {
    for (const code of [...KQ_STARTING_EQUIPMENT_CODES, "SECURITY-DOG", "PRESS-0600", "WASHER-25L", "SIFT-TRAY", "FREEZE-DRYER", "SECURITY-FENCE", "unknown"]) {
      expect(getKqCultureEquipmentCondition(code, 10, 100)).toBeNull();
      expect(getKqCultureWearAmount(code, 0, "intensive")).toBe(0);
    }
  });

  it("uses one starter per broken essential slot without doubling working equipment bonuses", () => {
    const installed = ["TENT-120", "LED-300", "AIR-EC6", "LED-300"];
    const codes = getKqCultureOperationalCodes(installed, {
      "TENT-120": condition("TENT-120", 100), "LED-300": condition("LED-300", 100),
    });
    expect(codes).toEqual(["AIR-EC6", "TENT-080-STARTER", "LED-150-STARTER"]);
    expect(new Set(codes.map(code => getKqEquipmentDefinition(code)?.slot)).size).toBe(codes.length);
    expect(summarizeKqEquipmentLoadout(codes).quantityPercent).toBe(0);
    expect(summarizeKqEquipmentLoadout(codes).regularityPercent).toBe(summarizeKqEquipmentLoadout(["AIR-EC6"]).regularityPercent);
    expect(getKqCultureOperationalCodes(installed, {})).toEqual(["TENT-120", "LED-300", "AIR-EC6"]);
    expect(installed).toEqual(["TENT-120", "LED-300", "AIR-EC6", "LED-300"]);
  });

  it("charges fallback starter power, preserves raw sales and produces a valid saved culture", () => {
    const installed = ["TENT-120", "LED-300", "AIR-EC6", "SOLAR-BACKUP", "SECURITY-CAMERA"];
    const broken = Object.fromEntries(installed.map(code => [code, condition(code, 100)]));
    const levels = Object.fromEntries(installed.map(code => [code, 10]));
    const codes = getKqCultureOperationalCodes(installed, broken);
    const quote = quoteKqEnergy(codes, levels, "balanced");
    const state = startKqGame(82, { equipmentCodes: codes, equipmentLevels: levels, energyMode: "balanced" });
    expect(codes).toEqual([...KQ_STARTING_EQUIPMENT_CODES]);
    expect(quote).toMatchObject({ totalCents: 603, solarPercent: 0, totalWattHours: 20_100 });
    expect(state.energy).toEqual(quote);
    expect(state.equipment?.unlocks).not.toContain("power-backup");
    expect(state.equipment?.unlocks).not.toContain("theft-protection");
    expect(parseKqGameSave(encodeKqSave(state))).toEqual(state);
    expect(quoteKqMarketRoutes({ juryScore: 8, harvestGrams: 100, equipmentCodes: codes })
      .find(route => route.route === "raw")?.available).toBe(true);
  });

  it("keeps an existing culture's bonuses and invoice after its equipment later breaks", () => {
    const installed = ["TENT-120", "LED-300", "AIR-EC6"];
    const state = startKqGame(15, { equipmentCodes: installed, energyMode: "intensive" });
    const saved = encodeKqSave(state);
    const nextCodes = getKqCultureOperationalCodes(installed, { "LED-300": condition("LED-300", 100) });
    const next = startKqGame(15, { equipmentCodes: nextCodes, energyMode: "intensive" });
    expect(parseKqGameSave(saved)).toEqual(state);
    expect(state.equipment?.codes).toContain("LED-300");
    expect(next.equipment?.codes).not.toContain("LED-300");
    expect(next.equipment!.quantityPercent).toBeLessThan(state.equipment!.quantityPercent);
    expect(next.energy!.totalCents).toBeLessThan(state.energy!.totalCents);
  });

  it("makes repeated intensive cultures incur meaningful replacement costs", () => {
    function simulate(mode: KqEnergyMode) {
      let wear = 0;
      let replacementCents = 0;
      let replacements = 0;
      // Replace only before the next culture, never charge for an unused future purchase.
      for (let cycle = 0; cycle < 51; cycle++) {
        const current = condition("LED-300", wear);
        if (current.due) {
          replacementCents += current.replacementCents;
          replacements++;
          wear = 0;
        }
        wear += getKqCultureWearAmount("LED-300", wear, mode);
      }
      return { replacementCents, replacements, wear };
    }
    expect(simulate("eco")).toEqual({ replacementCents: 35_900, replacements: 1, wear: 2 });
    expect(simulate("balanced")).toEqual({ replacementCents: 71_800, replacements: 2, wear: 55 });
    expect(simulate("intensive")).toEqual({ replacementCents: 179_500, replacements: 5, wear: 10 });
    const eco = getKqCultureWearPreview("LED-300", condition("LED-300"), "eco")!;
    const intensive = getKqCultureWearPreview("LED-300", condition("LED-300"), "intensive")!;
    const electricityDifference = quoteKqEnergy(["LED-300"], {}, "intensive").totalCents
      - quoteKqEnergy(["LED-300"], {}, "eco").totalCents;
    expect(intensive.wearCostCents - eco.wearCostCents).toBeGreaterThan(electricityDifference);
  });
});
