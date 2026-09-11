import { describe, expect, it } from "vitest";
import { KQ_EQUIPMENT_CATALOG, KQ_EQUIPMENT_REPLACEMENTS, getKqEquipmentAtLevel, getKqEquipmentUpgradeCost, summarizeKqEquipmentLoadout } from "./kanab-quest-equipment";
import { getKqEquipmentArtwork, getKqEquipmentVisualTier } from "./kanab-quest-equipment-artwork";
import { startKqGame } from "./kanab-quest-game";
import { encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";
import { quoteKqMarketRoutes } from "./kanab-quest-market";

describe("unique equipment and ten-level progression", () => {
  const purchasable = KQ_EQUIPMENT_CATALOG.filter((item) => item.purchasable);
  it("sells exactly one machine for each function, without the retired models", () => {
    expect(purchasable).toHaveLength(12);
    expect(new Set(purchasable.map((item) => item.slot)).size).toBe(purchasable.length);
    expect(purchasable.every((item) => !KQ_EQUIPMENT_REPLACEMENTS[item.code])).toBe(true);
  });

  it.each(purchasable)("improves $code at every level without mutating its base definition", (base) => {
    expect(getKqEquipmentAtLevel(base.code, 1)).toEqual(base);
    let previous = base;
    for (let level = 2; level <= 10; level++) {
      const current = getKqEquipmentAtLevel(base.code, level)!;
      expect(current.effects).not.toEqual(previous.effects);
      for (const [field, value] of Object.entries(previous.effects)) {
        expect(current.effects[field as keyof typeof current.effects]).toBeGreaterThanOrEqual(value!);
      }
      expect(current.powerWatts).toBe(base.powerWatts);
      expect(current.effects.pressureDelta).toBe(base.effects.pressureDelta);
      expect(getKqEquipmentUpgradeCost(base.code, level - 1)).toBe(Math.ceil(base.priceCents * (level - 1) / 10));
      previous = current;
    }
    expect(getKqEquipmentAtLevel(base.code, 1)).toEqual(base);
    expect(getKqEquipmentUpgradeCost(base.code, 10)).toBeNull();
  });

  it("rejects invalid, starter and retired upgrades", () => {
    for (const level of [0, -1, 1.5, 11, NaN, Infinity]) expect(getKqEquipmentUpgradeCost("LED-300", level)).toBeNull();
    for (const code of ["UNKNOWN", "LED-150-STARTER", ...Object.keys(KQ_EQUIPMENT_REPLACEMENTS)]) expect(getKqEquipmentUpgradeCost(code, 1)).toBeNull();
    expect(getKqEquipmentAtLevel("LED-150-STARTER", 10)?.effects).toEqual({});
  });

  it("snapshots only equipped levels and rejects tampered or invalid saved bonuses", () => {
    const levels = { "LED-300": 5, "TENT-120": 10 };
    const state = startKqGame(47, { equipmentCodes: ["LED-300"], equipmentLevels: levels });
    expect(state.equipment?.levels).toEqual({ "LED-300": 5 });
    expect(state.equipment?.quantityPercent).toBe(28);
    levels["LED-300"] = 10;
    expect(parseKqGameSave(encodeKqSave(state))?.equipment?.levels).toEqual({ "LED-300": 5 });
    expect(parseKqGameSave(encodeKqSave({ ...state, equipment: { ...state.equipment, quantityPercent: 999 } }))).toBeNull();
    expect(parseKqGameSave(encodeKqSave({ ...state, equipment: { ...state.equipment, levels: { "LED-300": 11 } } }))).toBeNull();
    const legacy = startKqGame(47, { equipmentCodes: ["LED-300"] });
    delete legacy.equipment!.levels;
    expect(parseKqGameSave(encodeKqSave(legacy))).not.toBeNull();
    expect(summarizeKqEquipmentLoadout([], levels).quantityPercent).toBe(0);
  });

  it("raises real processing proceeds at each level, including machines already at full capacity", () => {
    for (const machine of purchasable.filter((item) => item.category === "processing")) {
      const route = machine.code === "AUTO-SIEVE" || machine.code === "FREEZE-DRYER" ? "hash-signature"
        : machine.code === "STATIC-PLASMA" ? "static-sift" : machine.slot === "press" ? "rosin-signature"
          : machine.slot === "washing" ? "ice-water-hash" : "dry-sift";
      let previous = 0;
      for (let level = 1; level <= 10; level++) {
        const quote = quoteKqMarketRoutes({ juryScore: 9, harvestGrams: 300,
          equipmentCodes: purchasable.map((item) => item.code), equipmentLevels: { [machine.code]: level },
        }).find((item) => item.route === route)!;
        expect(quote.available).toBe(true);
        expect(quote.payoutCents, `${machine.code} level ${level}`).toBeGreaterThan(previous);
        previous = quote.payoutCents;
      }
    }
  });

  it("changes visual tiers only at 5 and 10, reusing distinct model illustrations", () => {
    expect(Array.from({ length: 10 }, (_, index) => getKqEquipmentVisualTier(index + 1))).toEqual([1, 1, 1, 1, 5, 5, 5, 5, 5, 10]);
    for (const code of ["TENT-120", "LED-300", "WASHER-25L", "PRESS-0600"]) {
      expect(new Set([1, 5, 10].map((level) => getKqEquipmentArtwork(code, level)?.src)).size).toBe(3);
      expect(getKqEquipmentArtwork(code, 4)?.src).toBe(getKqEquipmentArtwork(code, 1)?.src);
      expect(getKqEquipmentArtwork(code, 9)?.src).toBe(getKqEquipmentArtwork(code, 5)?.src);
    }
  });
});
