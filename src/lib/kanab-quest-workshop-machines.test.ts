import { describe, expect, it } from "vitest";
import { getKqWorkshopMachineSpecification } from "./kanab-quest-workshop-machines";
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
});
