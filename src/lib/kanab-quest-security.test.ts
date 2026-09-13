import { describe, expect, it } from "vitest";
import { getKqEquipmentAtLevel, projectKqEquipmentLoadout } from "./kanab-quest-equipment";
import { isKqEnergyQuoteValid, quoteKqDogCare, quoteKqEnergy } from "./kanab-quest-energy";
import { startKqGame, resolveKqStage, KQ_SITUATIONS } from "./kanab-quest-game";
import { encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";

describe("security equipment and care", () => {
  it("quotes food every cycle and vet care on the tenth and twentieth cycles", () => {
    expect(Array.from({ length: 20 }, (_, cycle) => quoteKqDogCare(cycle).nextTotalCents))
      .toEqual([800,800,800,800,800,800,800,800,800,4800,800,800,800,800,800,800,800,800,800,4800]);
    expect(quoteKqDogCare(9).cyclesUntilVet).toBe(1);
    expect(quoteKqDogCare(10).cyclesUntilVet).toBe(10);
  });
  it("charges installed fence electricity, with level, mode and solar adjustments", () => {
    expect(quoteKqEnergy(["SECURITY-FENCE"]).totalCents).toBe(189);
    expect(quoteKqEnergy(["SECURITY-DOG"]).totalCents).toBe(0);
    expect(quoteKqEnergy(["SECURITY-FENCE", "SECURITY-FENCE"]).totalCents).toBe(189);
    expect(quoteKqEnergy(["SECURITY-FENCE"], {}, "intensive").totalCents).toBeGreaterThan(189);
    expect(quoteKqEnergy(["SECURITY-FENCE"], {"SECURITY-FENCE":10}).totalCents).toBeGreaterThan(189);
    expect(quoteKqEnergy(["SECURITY-FENCE", "SOLAR-BACKUP"]).totalCents).toBeLessThan(189);
  });
  it("replaces the active security choice instead of stacking bonuses", () => {
    const projected = projectKqEquipmentLoadout({equippedCodes:["SECURITY-DOG"],candidateCodes:["SECURITY-FENCE"],ownedCodes:["SECURITY-DOG"]});
    expect(projected.equipmentCodes).toEqual(["SECURITY-FENCE"]);
    expect(projected.regularityPercent).toBe(4);
    expect(getKqEquipmentAtLevel("SECURITY-DOG", 10)?.effects.regularityPercent).toBe(17);
  });
  it("keeps saved camera runs valid after the cosmetic rename, without accepting changed costs", () => {
    const state = startKqGame(42, {equipmentCodes:["SECURITY-CAMERA"],energyMode:"balanced"});
    state.energy!.lines[0].name = "Caméra cabossée";
    expect(parseKqGameSave(encodeKqSave(state))).not.toBeNull();
    expect(isKqEnergyQuoteValid({...state.energy, totalCents:0},["SECURITY-CAMERA"])).toBe(false);
    state.energy!.lines[0].name = "invented";
    expect(parseKqGameSave(encodeKqSave(state))).toBeNull();
  });
  it.each(["SECURITY-CAMERA", "SECURITY-DOG", "SECURITY-FENCE"])("%s protects against theft and names the actual protection", (code) => {
    const state = startKqGame(42, {equipmentCodes:[code],energyMode:"balanced"});
    const theft = KQ_SITUATIONS.find((item) => item.incident === "crop-theft")!;
    state.stageIndex = 4;
    state.situationCodes[state.stageIndex] = theft.code;
    state.phase = "rolled";
    state.dice = [1,1,1];
    const resolved = resolveKqStage(state);
    expect(resolved.harvestLossPercent).toBe(0);
    expect(resolved.effectNotices?.some((notice) => notice.includes(getKqEquipmentAtLevel(code)!.name))).toBe(true);
  });
});
