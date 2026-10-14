import { describe, expect, it } from "vitest";
import { KQ_WAREHOUSE_CATALOG } from "./kanab-quest-warehouse-catalog";
import {
  KQ_WAREHOUSE_AREA_M2,
  KQ_WAREHOUSE_SIMULATION,
  createKqWarehouseStarter,
  doKqWarehouseZonesOverlap,
  getKqWarehouseEquipmentDemand,
  getKqWarehouseQuote,
  getKqWarehouseRunSnapshot,
  getKqWarehouseSummary,
  getKqWarehouseZoneQuote,
  isKqWarehouseRunSnapshot,
  isKqWarehouseState,
  projectKqWarehouseChain,
  validateKqWarehouseZones,
  type KqWarehouseChainInput,
  type KqWarehouseState,
  type KqWarehouseZone,
} from "./kanab-quest-warehouse";

const zone = (overrides: Partial<KqWarehouseZone> = {}): KqWarehouseZone => ({
  id: "one", name: "Zone 1", x: 0, y: 0, width: 1, height: 1, active: true,
  lightingCode: "MH-TS1000", airCode: "SJ-DF16E350", ...overrides,
});
const empty: KqWarehouseState = { version: 1, zones: [], equipment: [], preparedAreaM2: 0 };
const state = (zones: KqWarehouseZone[]) => getKqWarehouseQuote({ ...empty, zones }).nextState;
const chain = (overrides: Partial<KqWarehouseChainInput> = {}) => projectKqWarehouseChain({
  harvestGrams: 1_000, dryingCapacityGrams: 1_000, storageCapacityGrams: 1_000,
  processingCapacityGramsPerHour: 100, flowerDemandGrams: 1_000,
  periodDays: 10, dryingDurationDays: 1, processingHoursPerDay: 2, ...overrides,
});

describe("warehouse 40 × 25 geometry", () => {
  it("has exactly 1,000 one-square-metre cells and permits the complete room", () => {
    expect(KQ_WAREHOUSE_AREA_M2).toBe(1_000);
    expect(validateKqWarehouseZones([zone({ width: 40, height: 25 })])).toEqual([]);
    expect(getKqWarehouseSummary(state([zone({ width: 40, height: 25 })]))).toMatchObject({ equippedAreaM2: 1_000, activeAreaM2: 1_000, freeAreaM2: 0 });
  });

  it.each([
    { x: -1 }, { x: 0.5 }, { width: 0 }, { height: 1.5 }, { width: 41 },
    { height: 26 }, { x: 40 }, { y: 25 }, { x: NaN }, { width: Infinity },
  ])("rejects invalid integer geometry %j", (change) => {
    expect(validateKqWarehouseZones([zone(change)])).not.toEqual([]);
  });

  it("permits touching edges but rejects a single overlapping cell", () => {
    const a = zone({ width: 10, height: 10 });
    const b = zone({ id: "two", x: 10, width: 10, height: 10 });
    expect(doKqWarehouseZonesOverlap(a, b)).toBe(false);
    expect(validateKqWarehouseZones([a, b])).toEqual([]);
    expect(validateKqWarehouseZones([a, { ...b, x: 9 }])).toContain("Les zones de culture ne peuvent pas se superposer.");
  });

  it("rejects duplicate IDs, incompatible devices and malformed runtime input", () => {
    expect(validateKqWarehouseZones([zone(), zone({ x: 1 })])).not.toEqual([]);
    expect(validateKqWarehouseZones([zone({ lightingCode: "SJ-DF16E350" })])).not.toEqual([]);
    expect(validateKqWarehouseZones([null])).not.toEqual([]);
    expect(validateKqWarehouseZones(null)).not.toEqual([]);
    expect(isKqWarehouseState({ ...empty, equipment: [{ code: "invented", quantity: 1 }] })).toBe(false);
    expect(isKqWarehouseState({ ...empty, equipment: [{ code: "MH-TS1000", quantity: 1.5 }] })).toBe(false);
  });
});

describe("physical equipment, investment and progressive expansion", () => {
  it("starts with one equipped square metre and enough drying/storage for its forecast", () => {
    const starter = createKqWarehouseStarter();
    const summary = getKqWarehouseSummary(starter);
    expect(summary).toMatchObject({ equippedAreaM2: 1, activeAreaM2: 1, dryingAreaM2: 1, storageAreaM2: 1,
      allocatedAreaM2: 3, freeAreaM2: 97, estimatedHarvestGrams: 250 });
    expect(summary.dryingCapacityGrams).toBeGreaterThanOrEqual(summary.estimatedHarvestGrams);
    expect(summary.storageCapacityGrams).toBeGreaterThanOrEqual(summary.estimatedHarvestGrams);
    expect(starter.equipment.every((item) => Number.isInteger(item.quantity))).toBe(true);
    expect(summary.investmentCents).toBeGreaterThan(40_000);
  });

  it("buys whole devices at capacity thresholds, including shared air capacity", () => {
    const two = getKqWarehouseZoneQuote(zone({ width: 2, lightingCode: "MH-FCE3000" }));
    const three = getKqWarehouseZoneQuote(zone({ width: 3, lightingCode: "MH-FCE3000" }));
    expect(two.devices.find((item) => item.code === "MH-FCE3000")?.quantity).toBe(1);
    expect(three.devices.find((item) => item.code === "MH-FCE3000")?.quantity).toBe(2);
    expect(getKqWarehouseZoneQuote(zone({ width: 20 })).devices.find((item) => item.code === "SJ-DF16E350")?.quantity).toBe(1);
    expect(getKqWarehouseZoneQuote(zone({ width: 21 })).devices.find((item) => item.code === "SJ-DF16E350")?.quantity).toBe(2);
    const lamp = KQ_WAREHOUSE_CATALOG.find((item) => item.code === "MH-FCE3000")!;
    expect(three.equipmentCostCents - two.equipmentCostCents).toBe(lamp.priceCents);
  });

  it("prices new surface plus real purchases and installation, never the entire old installation", () => {
    const previous = state([zone()]);
    const quote = getKqWarehouseQuote({ ...previous, zones: [zone({ width: 2 })] }, previous);
    expect(quote.purchases.map((item) => [item.code, item.quantity])).toEqual([["MH-TS1000", 1]]);
    expect(quote.addedAreaM2).toBe(1);
    expect(quote.preparationCostCents).toBe(KQ_WAREHOUSE_SIMULATION.preparationCentsPerM2);
    expect(quote.totalCostCents).toBe(quote.equipmentCostCents + quote.preparationCostCents + quote.installationCostCents);
    expect(getKqWarehouseQuote(quote.nextState, quote.nextState).totalCostCents).toBe(0);
  });

  it("keeps replaced devices in reserve and reuses them without refunds", () => {
    const previous = state([zone()]);
    const replacement = getKqWarehouseQuote({ ...previous, zones: [zone({ lightingCode: "SIM-LIGHT-02" })] }, previous);
    expect(replacement.purchases.map((item) => [item.code, item.quantity])).toEqual([["SIM-LIGHT-02", 1]]);
    expect(getKqWarehouseSummary(replacement.nextState).reserve).toEqual([{ code: "MH-TS1000", quantity: 1 }]);
    const restored = getKqWarehouseQuote({ ...replacement.nextState, zones: [zone()] }, replacement.nextState);
    expect(restored.totalCostCents).toBe(0);
    expect(getKqWarehouseSummary(restored.nextState).reserve).toEqual([{ code: "SIM-LIGHT-02", quantity: 1 }]);
  });

  it("retains purchased equipment and preparation after removing all zones", () => {
    const previous = state([zone({ width: 4 })]);
    const removed = getKqWarehouseQuote({ ...empty }, previous);
    expect(removed.nextState.equipment).toEqual(previous.equipment);
    expect(removed.nextState.preparedAreaM2).toBe(4);
    expect(removed.totalCostCents).toBe(0);
    const rebuilt = getKqWarehouseQuote({ ...removed.nextState, zones: [zone({ x: 20, width: 4 })] }, removed.nextState);
    expect(rebuilt.totalCostCents).toBe(0);
    expect(getKqWarehouseSummary(removed.nextState).estimatedHarvestGrams).toBe(0);
  });

  it("never trusts claimed prepaid area or new inventory from an unpriced client draft", () => {
    const quote = getKqWarehouseQuote({ ...empty, preparedAreaM2: 1_000, zones: [zone()], equipment: [{ code: "MH-TS1000", quantity: 5 }] }, empty);
    expect(quote.nextState.preparedAreaM2).toBe(1);
    expect(quote.preparationCostCents).toBeGreaterThan(0);
    expect(quote.purchases.find((item) => item.code === "MH-TS1000")?.quantity).toBe(5);
    expect(() => getKqWarehouseRunSnapshot({ ...empty, zones: [zone()] })).toThrow(/financé/);
  });

  it("keeps inactive zones equipped while charging only active devices", () => {
    const plan = state([zone(), zone({ id: "off", x: 1, width: 3, active: false })]);
    expect(getKqWarehouseEquipmentDemand(plan.zones).find((item) => item.code === "MH-TS1000")?.quantity).toBe(4);
    const summary = getKqWarehouseSummary(plan);
    expect(summary).toMatchObject({ equippedAreaM2: 4, activeAreaM2: 1, freeAreaM2: 996 });
    const one = getKqWarehouseSummary(state([zone()]));
    expect(summary.energyKwh).toBe(one.energyKwh);
    expect(summary.operatingCostCents).toBe(one.operatingCostCents);
    expect(summary.estimatedHarvestGrams).toBe(one.estimatedHarvestGrams);
    expect(summary.energyCostCents).toBe(Math.round(summary.energyKwh * KQ_WAREHOUSE_SIMULATION.electricityCentsPerKwh));
  });

  it("captures an independent revisioned run and detects forged totals and insufficient devices", () => {
    const starter = createKqWarehouseStarter();
    const snapshot = getKqWarehouseRunSnapshot(starter, 7);
    expect(isKqWarehouseRunSnapshot(snapshot)).toBe(true);
    expect(snapshot.revision).toBe(7);
    starter.zones[0].width = 10;
    starter.equipment[0].quantity = 99;
    expect(snapshot.sourceState.zones[0].width).toBe(1);
    expect(snapshot.zones[0].width).toBe(1);
    expect(isKqWarehouseRunSnapshot({ ...snapshot, estimatedHarvestGrams: 100_000 })).toBe(false);
    expect(isKqWarehouseRunSnapshot({ ...snapshot, energyCostCents: 0 })).toBe(false);
    expect(isKqWarehouseRunSnapshot({ ...snapshot, storageCapacityGrams: 1_000_000 })).toBe(false);
    expect(isKqWarehouseRunSnapshot({ ...snapshot, sourceState: { ...snapshot.sourceState, equipment: [] } })).toBe(false);
    expect(() => getKqWarehouseRunSnapshot(state([zone({ active: false })]))).toThrow(/Active/);
  });
});

describe("production, processing, storage and sales share one finite material flow", () => {
  it("leaves an excess harvest awaiting drying instead of multiplying concurrent capacity by time", () => {
    const result = chain({ harvestGrams: 10_000, dryingCapacityGrams: 2_000, flowerDemandGrams: 20_000, periodDays: 60 });
    expect(result).toMatchObject({ dryingAcceptedGrams: 2_000, dryingCompletedGrams: 2_000, waitingForDryingGrams: 8_000, soldFlowerGrams: 2_000 });
    expect(result.bottlenecks).toContain("drying");
  });

  it("cannot sell a harvest before the drying interval has elapsed", () => {
    const result = chain({ periodDays: 0.5, dryingDurationDays: 1 });
    expect(result).toMatchObject({ dryingInProgressGrams: 1_000, dryingCompletedGrams: 0, soldFlowerGrams: 0 });
  });

  it("caps sales by demand and preserves the unsold stock", () => {
    const result = chain({ harvestGrams: 10_000, dryingCapacityGrams: 10_000, storageCapacityGrams: 10_000, flowerDemandGrams: 6_000 });
    expect(result).toMatchObject({ soldFlowerGrams: 6_000, closingFlowerGrams: 4_000, closingStockGrams: 4_000, storageOverflowGrams: 0 });
    expect(result.bottlenecks).toEqual(["sales"]);
  });

  it("does not create buyers when cultivation expands", () => {
    const small = chain({ harvestGrams: 250, flowerDemandGrams: 250 });
    const large = chain({ harvestGrams: 750, flowerDemandGrams: 250 });
    expect(small.soldFlowerGrams).toBe(large.soldFlowerGrams);
    expect(large.closingStockGrams - small.closingStockGrams).toBe(500);
  });

  it("makes processing optional and caps it by requested input, stock and available machine hours", () => {
    expect(chain().processedInputGrams).toBe(0);
    const result = chain({ processingRequestedGrams: 10_000, periodDays: 2, dryingDurationDays: 1, processingHoursPerDay: 1, processingCapacityGramsPerHour: 100 });
    expect(result.processedInputGrams).toBe(100);
    expect(result.processedOutputGrams).toBe(15);
    expect(result.soldFlowerGrams).toBe(900);
    expect(result.bottlenecks).toContain("processing");
    expect(chain({ processingRequestedGrams: 10_000, processingCapacityGramsPerHour: 1_000_000 }).processedInputGrams).toBe(1_000);
  });

  it("can process existing dry inventory before the next harvest finishes drying", () => {
    const result = chain({ stockFlowerGrams: 500, processingRequestedGrams: 1_000, periodDays: 1, dryingDurationDays: 3 });
    expect(result.processedInputGrams).toBe(200);
    expect(result.dryingCompletedGrams).toBe(0);
  });

  it("reports insufficient storage without silently deleting or auto-selling overflow", () => {
    const result = chain({ stockFlowerGrams: 500, storageCapacityGrams: 100, flowerDemandGrams: 0 });
    expect(result).toMatchObject({ closingStockGrams: 1_500, storageOverflowGrams: 1_400 });
    expect(result.bottlenecks).toContain("storage");
  });

  it("conserves all dry-equivalent matter across inventory, queues, sales and processing residue", () => {
    for (const demand of [0, 100, 10_000]) {
      const result = chain({ harvestGrams: 1_237, dryingCapacityGrams: 900, stockFlowerGrams: 63, stockProcessedGrams: 27,
        flowerDemandGrams: demand, processedDemandGrams: demand, processingRequestedGrams: 333, processingOutputRatio: 0.17 });
      const incoming = result.harvestGrams + 63 + 27;
      const outgoing = result.waitingForDryingGrams + result.dryingInProgressGrams + result.soldFlowerGrams + result.soldProcessedGrams
        + result.closingStockGrams + result.processingResidueGrams;
      expect(outgoing).toBeCloseTo(incoming, 8);
    }
  });

  it("handles a zero period without sales and rejects malformed or non-finite inputs", () => {
    expect(chain({ periodDays: 0, stockFlowerGrams: 100 }).soldFlowerGrams).toBe(0);
    for (const change of [{ harvestGrams: -1 }, { harvestGrams: NaN }, { flowerDemandGrams: Infinity }, { processingOutputRatio: 1.1 }, { processingHoursPerDay: 25 }]) {
      expect(() => chain(change)).toThrow(/invalide/);
    }
    expect(() => projectKqWarehouseChain({} as KqWarehouseChainInput)).toThrow(/invalide/);
  });
});
