import { describe, expect, it } from "vitest";
import { getKqWorkshopMachineSpecification, getKqWorkshopTierPrice } from "./kanab-quest-workshop-machines";
import retail from "./kanab-quest-workshop-retail.json";
import { getKqEquipmentDefinition, getKqEquipmentUpgradeCost } from "./kanab-quest-equipment";
import { quoteKqMarketRoutes } from "./kanab-quest-market";

const quote = (grams: number, level = 1) => quoteKqMarketRoutes({ juryScore: 9, harvestGrams: grams,
  equipmentCodes: ["TENT-080-STARTER", "PRESS-0600"], equipmentLevels: { "PRESS-0600": level } });

describe("workshop capacity and configurations", () => {
  it("does not multiply the capacity of a shared press with the harvest", () => {
    const small = quote(100).find(item => item.route === "rosin-trial")!;
    const large = quote(800).find(item => item.route === "rosin-trial")!;
    expect(small.processedInputGrams).toBe(80);
    expect(large.processedInputGrams).toBe(80);
    expect(large.productGrams).toBe(small.productGrams);
    expect(large.remainderGrams).toBe(720);
    expect(large.remainderDestination).toBe("raw");
  });
  it("uses the smallest physical capacity in a processing chain", () => {
    const route = quoteKqMarketRoutes({ juryScore: 9, harvestGrams: 800,
      equipmentCodes: ["TENT-080-STARTER", "WASHER-25L", "AUTO-SIEVE", "FREEZE-DRYER"],
      equipmentLevels: { "WASHER-25L": 10 } }).find(item => item.route === "hash-signature")!;
    expect(route.available).toBe(true);
    expect(route.processedInputGrams).toBe(500);
    expect(route.remainderGrams).toBe(300);
  });
  it("requires the corresponding press configuration even for a perfect harvest", () => {
    expect(quote(100).filter(item => item.family === "rosin" && item.available).map(item => item.route)).toEqual(["rosin-trial"]);
    expect(quote(100, 4).find(item => item.route === "rosin-selection")?.available).toBe(true);
    expect(quote(100, 7).find(item => item.route === "rosin-premium")?.available).toBe(true);
    expect(quote(100, 10).find(item => item.route === "rosin-signature")?.available).toBe(true);
  });
  it("describes three configurations without discarding acquired upgrade indices", () => {
    expect([1, 4, 7].map(level => getKqWorkshopMachineSpecification("PRESS-0600", level)?.configuration)).toEqual([1, 2, 3]);
    expect(getKqWorkshopMachineSpecification("PRESS-0600", 10)?.capacityGrams).toBe(464);
    expect(getKqWorkshopMachineSpecification("unknown")).toBeNull();
    expect(getKqWorkshopMachineSpecification("toString")).toBeNull();
  });
  it("prices a direct purchase exactly like the existing acquisition and paid upgrades", () => {
    for (const [code, offers] of Object.entries(retail)) {
      const base = getKqEquipmentDefinition(code)!.priceCents;
      for (const [index, target] of [1, 4, 7].entries()) {
        expect(getKqWorkshopTierPrice(code, target)).toBe(offers[index].gamePriceCents);
        const expected = base + Array.from({ length: target - 1 }, (_, level) => getKqEquipmentUpgradeCost(code, level + 1)!).reduce((sum, price) => sum + price, 0);
        expect(getKqWorkshopTierPrice(code, target)).toBe(expected);
      }
    }
    expect([1, 4, 7].map(target => getKqWorkshopTierPrice("WASHER-25L", target))).toEqual([630000, 3480000, 8580000]);
  });
  it("credits acquired intermediate levels to the cent and refuses invalid levels or unknown models", () => {
    expect(getKqWorkshopTierPrice("PRESS-0600", 4, 2)).toBe(526667);
    expect(getKqWorkshopTierPrice("PRESS-0600", 7, 5)).toBe(613334);
    expect(getKqWorkshopTierPrice("WASHER-25L", 4, 1)).toBe(2850000);
    for (const [code, target, current] of [["unknown", 4, 1], ["toString", 4, 0], ["PRESS-0600", 4, 4], ["PRESS-0600", 7, 10], ["PRESS-0600", 5, 1], ["PRESS-0600", 4, -1], ["PRESS-0600", 7, 1.5]] as const) {
      expect(getKqWorkshopTierPrice(code, target, current)).toBeNull();
    }
  });
});
