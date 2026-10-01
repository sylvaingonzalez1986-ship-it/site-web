import { describe, expect, it } from "vitest";
import { buildKqTentEquipmentSummary, getKqEquipmentScope, getKqEquipmentStorageTent, KQ_STARTING_EQUIPMENT_CODES } from "./kanab-quest-equipment";

describe("tent equipment recap", () => {
  it("makes the three essential slots and four optional services explicit", () => {
    const summary = buildKqTentEquipmentSummary({ ownedCodes: [], equippedCodes: [] });
    expect(summary.slots).toHaveLength(7);
    expect(summary.slots.filter(slot => slot.required).map(slot => slot.slot)).toEqual(["tent", "lighting", "air"]);
    expect(summary.slots.filter(slot => slot.status === "optional")).toHaveLength(4);
    expect(summary).toMatchObject({ missingRequiredCount: 3, installedCount: 0, ready: false });
  });

  it("keeps equipment in reserve distinct from installed equipment and the common workshop", () => {
    const summary = buildKqTentEquipmentSummary({
      ownedCodes: [...KQ_STARTING_EQUIPMENT_CODES, "LED-300", "CLIMATE-SMART", "WASHER-25L"],
      equippedCodes: [...KQ_STARTING_EQUIPMENT_CODES, "WASHER-25L"],
    });
    expect(summary).toMatchObject({ installedCount: 3, missingRequiredCount: 0, availableCount: 1, ready: true });
    expect(summary.slots.find(slot => slot.slot === "lighting")?.ownedAlternatives.map(item => item.code)).toEqual(["LED-300"]);
    expect(summary.slots.find(slot => slot.slot === "climate-controller")).toMatchObject({ equipment: null, status: "available" });
    expect(summary.slots.some(slot => slot.equipment?.category === "processing")).toBe(false);
  });

  it("reports a missing essential even when its replacement is owned but not installed", () => {
    const summary = buildKqTentEquipmentSummary({ ownedCodes: ["LED-300"], equippedCodes: [] });
    expect(summary.slots.find(slot => slot.slot === "lighting")).toMatchObject({ status: "available", required: true });
    expect(summary.missingRequiredCount).toBe(3);
    expect(summary.ready).toBe(false);
  });

  it("shows actual worn equipment rather than mistaking a virtual starter fallback for an installation", () => {
    const summary = buildKqTentEquipmentSummary({
      ownedCodes: ["TENT-080-STARTER", "LED-300", "AIR-STARTER"],
      equippedCodes: ["TENT-080-STARTER", "LED-300", "AIR-STARTER"],
      levels: { "LED-300": 6 }, cultureWear: { "LED-300": { due: true, wearPercent: 100 } },
    });
    expect(summary.slots.find(slot => slot.slot === "lighting")).toMatchObject({ equipment: { code: "LED-300" }, status: "worn", level: 6 });
    expect(summary).toMatchObject({ missingRequiredCount: 0, wornCount: 1, ready: false });
  });

  it.each(["DRYING-ROOM", "SOLAR-BACKUP", "SECURITY-DOG", "SECURITY-CAMERA", "LED-300"])("attaches %s to its own tent", code => {
    expect(getKqEquipmentScope(code)).toBe("tent");
    expect(getKqEquipmentStorageTent(code, 4)).toBe(4);
  });

  it.each(["SIFT-TRAY", "WASHER-25L", "AUTO-SIEVE", "STATIC-PLASMA", "PRESS-0600", "FREEZE-DRYER"])("shares transformation machine %s once", code => {
    expect(getKqEquipmentScope(code)).toBe("workshop");
    expect(getKqEquipmentStorageTent(code, 4)).toBe(1);
  });
});
