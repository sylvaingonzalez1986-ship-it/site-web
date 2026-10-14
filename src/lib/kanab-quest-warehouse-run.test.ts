import { describe, expect, it } from "vitest";
import { advanceKqStage, getKqHarvestBreakdown, resolveKqStage, startKqGame, type KqGameState } from "./kanab-quest-game";
import { createKqIntegrityCode, encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";
import { createKqWarehouseStarter, getKqWarehouseQuote, getKqWarehouseRunSnapshot } from "./kanab-quest-warehouse";
import { quoteKqWarehouseEnergy } from "./kanab-quest-warehouse-run";
import { quoteKqMarketRoutes } from "./kanab-quest-market";
import { quoteKqCommerce, type KqCommerceState, type KqCommerceStock } from "./kanab-quest-commerce";

function room(width = 1, height = 1) {
  const starter = createKqWarehouseStarter();
  return getKqWarehouseRunSnapshot(getKqWarehouseQuote({ ...starter,
    zones: starter.zones.map(zone => ({ ...zone, width, height })),
  }, starter).nextState, 3);
}
function finish(initial: KqGameState) {
  let state = initial;
  while (state.phase !== "complete") state = advanceKqStage(resolveKqStage({ ...state, phase: "rolled", dice: [6, 6, 6] }));
  return state;
}

describe("physical warehouse through the shared culture", () => {
  it("uses surface and installed devices while ignoring old tent upgrades and energy modes", () => {
    const warehouse = room(8, 5);
    const initial = startKqGame(300, { warehouse, productionUnits: 8, equipmentCodes: ["TENT-120", "LED-300"],
      equipmentLevels: { "TENT-120": 10, "LED-300": 10 }, energyMode: "intensive" });
    expect(initial.equipment).toMatchObject({ codes: [], quantityPercent: 0, qualityMaxBonus: 0, powerWatts: 0 });
    expect(initial.equipment?.productionUnits).toBeUndefined();
    expect(initial.energy).toEqual(quoteKqWarehouseEnergy(warehouse));
    const completed = finish(initial);
    const small = finish(startKqGame(300, { warehouse: room() }));
    expect(completed.harvestGrams).toBeGreaterThan(4_000);
    expect(completed.harvestGrams).toBeLessThanOrEqual(warehouse.estimatedHarvestGrams);
    expect(completed.harvestGrams! / 40).toBeCloseTo(small.harvestGrams!, 1);
    expect(completed.quality).toBe(small.quality);
    expect(completed.history).toEqual(small.history);
    expect(getKqHarvestBreakdown(completed).tentHarvests).toBeNull();
    expect(parseKqGameSave(encodeKqSave(completed))).toEqual(completed);
  });

  it("freezes the source plan, verifies all projections, and signs it into integrity", () => {
    const warehouse = room();
    const game = startKqGame(300, { warehouse });
    warehouse.sourceState.zones[0].width = 20;
    expect(game.warehouse?.sourceState.zones[0].width).toBe(1);
    expect(parseKqGameSave(encodeKqSave(game))).toEqual(game);
    expect(createKqIntegrityCode(game)).not.toBe(createKqIntegrityCode(startKqGame(300, { warehouse: room(2) })));
    for (const field of ["energyCostCents", "activeAreaM2", "estimatedHarvestGrams", "dryingCapacityGrams"] as const) {
      const altered = structuredClone(game);
      altered.warehouse![field] += 1;
      expect(parseKqGameSave(encodeKqSave(altered))).toBeNull();
    }
    expect(parseKqGameSave(encodeKqSave({ ...game, energy: { ...game.energy!, totalCents: 0 } }))).toBeNull();
    expect(parseKqGameSave(encodeKqSave({ ...finish(game), harvestGrams: 250.1 }))).toBeNull();
  });

  it("keeps a failed room at zero and preserves the frozen operating costs", () => {
    const initial = startKqGame(300, { warehouse: room() });
    initial.care!.vitality = 1;
    const failed = resolveKqStage({ ...initial, phase: "rolled", dice: [1, 1, 1] });
    expect(failed.cultureDead).toBe(true);
    expect(failed.harvestGrams).toBe(0);
    expect(failed.energy).toEqual(initial.energy);
    expect(parseKqGameSave(encodeKqSave(failed))).toEqual(failed);
  });

  it("passes the full harvest to the market and applies actual parallel machine capacity", () => {
    const quotes = quoteKqMarketRoutes({ juryScore: 9, harvestGrams: 25_000,
      equipmentCodes: ["TENT-080-STARTER", "PRESS-0600"], processingBatchGrams: { "PRESS-0600": 240 }, processWholeLot: true });
    expect(quotes.find(quote => quote.route === "raw")?.productGrams).toBe(25_000);
    expect(quotes.find(quote => quote.route === "rosin-trial")).toMatchObject({ processedInputGrams: 25_000, remainderGrams: 0, processingBatchGrams: 240 });
  });

  it("keeps workshop progression and quality gates when processing a complete warehouse lot", () => {
    const input = { juryScore: 9.8, harvestGrams: 250, equipmentCodes: ["TENT-080-STARTER", "WASHER-25L", "PRESS-0600"],
      processingBatchGrams: { "WASHER-25L": 500, "PRESS-0600": 80 }, processWholeLot: true,
      marketContext: { reputation: 0, routeSales: {}, recentSales: {}, marketVolumes: {}, window: 0 } };
    const quotes = quoteKqMarketRoutes(input);
    expect(quotes.find(quote => quote.route === "ice-water-hash")).toMatchObject({ available: false, market: { progressionReason: expect.any(String) } });
    expect(quotes.find(quote => quote.route === "rosin-signature")).toMatchObject({ available: false, market: { progressionReason: expect.any(String) } });
    const experienced = quoteKqMarketRoutes({ ...input, equipmentLevels: { "WASHER-25L": 10, "PRESS-0600": 10 },
      marketContext: { ...input.marketContext, reputation: 100, routeSales: { "dry-sift": 12, "rosin-trial": 12 } } });
    expect(experienced.find(quote => quote.route === "ice-water-hash")?.available).toBe(true);
    expect(experienced.find(quote => quote.route === "rosin-signature")?.available).toBe(true);
    expect(quotes.find(quote => quote.route === "dry-sift")?.available).toBe(false);
    expect(quoteKqMarketRoutes({ ...input, juryScore: 5 }).find(quote => quote.route === "ice-water-hash")?.available).toBe(false);
  });
});

describe("warehouse commerce constraints", () => {
  const stock: KqCommerceStock = { id: "stock", flowerId: "flower", name: "Lot", route: "raw", batchRoute: "raw",
    juryScore: 9, initialUnits: 100_000, remainingUnits: 100_000, equivalentUnits: 100_000, originalUnits: 100_000,
    baseUnitCents: 180, repExact: 0, repRounded: 0, professionalUnits: 0, counted: false };
  const state: KqCommerceState = { revision: 0, cashCents: 100_000, reputation: 0, clients: 0, computerOwned: false,
    internetRenew: false, campaign: null, stocks: [stock], receipts: [], marketVolumes: {}, ownVolumes: {}, routeSales: {},
    wholesale: { remainingEquivalentUnits: 1_000, capacityEquivalentUnits: 10_000, resetsAt: null } };

  it("limits wholesalers by shared equivalent mass including processed lots", () => {
    expect(quoteKqCommerce(state, stock, "wholesale").units).toBe(1_000);
    const transformed = { ...stock, route: "rosin-trial" as const, initialUnits: 10_000, remainingUnits: 10_000 };
    expect(quoteKqCommerce(state, transformed, "wholesale").units).toBe(100);
    expect(quoteKqCommerce({ ...state, wholesale: { ...state.wholesale!, remainingEquivalentUnits: 0 } }, stock, "wholesale").units).toBe(0);
  });

  it("does not sell an unfinished batch and releases it at its server deadline", () => {
    const now = Date.parse("2026-10-12T10:00:00Z");
    const waiting = { ...stock, processingReadyAt: new Date(now + 3_600_000).toISOString() };
    expect(quoteKqCommerce(state, waiting, "wholesale", "advised", undefined, now)).toMatchObject({ units: 0, reason: expect.stringContaining("Transformation") });
    expect(quoteKqCommerce(state, waiting, "wholesale", "advised", undefined, now + 3_600_000).units).toBe(1_000);
  });
});
