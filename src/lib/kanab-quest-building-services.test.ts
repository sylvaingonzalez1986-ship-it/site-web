import { describe, expect, it } from "vitest";
import { getKqEquipmentCartTotal, getKqEquipmentStorageTent, KQ_STARTING_EQUIPMENT_CODES } from "./kanab-quest-equipment";
import { getKqEffectiveTentProfiles, summarizeKqTentEquipment } from "./kanab-quest-production";
import { quoteKqTentEnergy } from "./kanab-quest-energy";
import { startKqGame } from "./kanab-quest-game";
import { encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";

const source = (units = 8): Parameters<typeof getKqEffectiveTentProfiles>[0] => ({
  equipmentScopeVersion: 3 as const,
  tents: Array.from({ length: units }, (_, index) => ({ tentNumber: index + 1,
    cultureOperationalCodes: [...KQ_STARTING_EQUIPMENT_CODES], levels: {} as Record<string, number> })),
  buildings: [
    { buildingNumber: 1, cultureOperationalCodes: ["DRYING-ROOM", "SECURITY-CAMERA", "SOLAR-BACKUP"], levels: { "DRYING-ROOM": 2, "SECURITY-CAMERA": 1, "SOLAR-BACKUP": 3 } },
    { buildingNumber: 2, cultureOperationalCodes: ["DRYING-ROOM"], levels: { "DRYING-ROOM": 1 } },
  ],
});

describe("physical services per building", () => {
  it("owns services at the building anchor and charges one purchase per building", () => {
    expect([1, 2, 4, 5, 6, 8].map(tent => getKqEquipmentStorageTent("SECURITY-CAMERA", tent))).toEqual([1, 1, 1, 5, 5, 5]);
    expect(getKqEquipmentStorageTent("PRESS-0600", 8)).toBe(1);
    expect(getKqEquipmentStorageTent("LED-300", 8)).toBe(8);
    expect(getKqEquipmentCartTotal(["DRYING-ROOM", "LED-300", "PRESS-0600"], 8)).toBe(2 * 60000 + 8 * 35900 + 85000);
  });

  it("serves only the four tents of its own building without changing physical ownership", () => {
    const physical = source();
    const effective = getKqEffectiveTentProfiles(physical);
    expect(effective.slice(0, 4).every(tent => tent.codes.includes("SOLAR-BACKUP"))).toBe(true);
    expect(effective.slice(4).every(tent => !tent.codes.includes("SOLAR-BACKUP"))).toBe(true);
    expect(effective[1].levels["DRYING-ROOM"]).toBe(2);
    expect(effective[5].levels["DRYING-ROOM"]).toBe(1);
    expect(physical.tents.every(tent => tent.cultureOperationalCodes.length === 3)).toBe(true);
    expect(getKqEffectiveTentProfiles({ ...physical, equipmentScopeVersion: 2 })[0].codes).toEqual([...KQ_STARTING_EQUIPMENT_CODES]);
  });

  it.each(["eco", "balanced", "intensive"] as const)("bills physical services once in %s mode and retains legacy per-tent invoices", mode => {
    const tents = getKqEffectiveTentProfiles(source());
    const current = quoteKqTentEnergy(tents, mode, "building");
    const legacy = quoteKqTentEnergy(tents, mode, "tent");
    expect(current.lines.filter(line => line.code === "DRYING-ROOM").map(line => line.buildingNumber)).toEqual([1, 2]);
    expect(current.lines.filter(line => line.code === "SECURITY-CAMERA")).toHaveLength(1);
    expect(current.lines.filter(line => line.code === "LED-150-STARTER")).toHaveLength(8);
    expect(legacy.lines.filter(line => line.code === "DRYING-ROOM")).toHaveLength(8);
    expect(current.totalCents).toBeLessThan(legacy.totalCents);
    expect(current.lines.filter(line => line.tentNumber === 5).every(line => line.buildingNumber === undefined || line.buildingNumber === 2)).toBe(true);
    expect(summarizeKqTentEquipment(tents, undefined, "building").powerWatts).toBeLessThan(summarizeKqTentEquipment(tents, undefined, "tent").powerWatts);
  });

  it("round-trips building runs and rejects conflicting service levels inside one building", () => {
    const tents = getKqEffectiveTentProfiles(source());
    for (const scope of ["building", "tent"] as const) {
      const state = startKqGame(300, { equipmentScope: scope, equipmentTents: tents, equipmentShared: { codes: [], levels: {} }, energyMode: "balanced" });
      expect(parseKqGameSave(encodeKqSave(state))).toEqual(state);
    }
    tents[1].levels["DRYING-ROOM"] = 10;
    const forged = startKqGame(300, { equipmentScope: "building", equipmentTents: tents, equipmentShared: { codes: [], levels: {} }, energyMode: "balanced" });
    expect(parseKqGameSave(encodeKqSave(forged))).toBeNull();
  });
});
