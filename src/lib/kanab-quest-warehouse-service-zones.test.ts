import { describe, expect, it } from "vitest";
import {
  createKqWarehouseStarter,
  getKqWarehouseEquipmentDemand,
  getKqWarehouseQuote,
  getKqWarehouseRunSnapshot,
  getKqWarehouseServiceZoneQuote,
  getKqWarehouseSummary,
  isKqWarehouseRunSnapshot,
  isKqWarehouseState,
  projectKqWarehouseChain,
  validateKqWarehouseServiceZones,
  validateKqWarehouseState,
  type KqWarehouseServiceZone,
  type KqWarehouseState,
  type KqWarehouseZone,
} from "./kanab-quest-warehouse";

const empty: KqWarehouseState = { version: 1, zones: [], serviceZones: [], equipment: [], preparedAreaM2: 0 };
const culture = (patch: Partial<KqWarehouseZone> = {}): KqWarehouseZone => ({
  id: "culture", name: "Culture", x: 0, y: 0, width: 1, height: 1, active: true,
  lightingCode: "MH-TS1000", airCode: "SJ-DF16E350", ...patch,
});
const service = (patch: Partial<KqWarehouseServiceZone> = {}): KqWarehouseServiceZone => ({
  id: "storage", name: "Stockage", x: 1, y: 0, width: 1, height: 1,
  kind: "storage", deviceCode: "LP-SUPER-1L", ...patch,
});
const paid = (serviceZones: KqWarehouseServiceZone[], zones: KqWarehouseZone[] = []) =>
  getKqWarehouseQuote({ ...empty, zones, serviceZones }).nextState;

describe("one physical floor shared by culture, drying and storage", () => {
  it("permits touching edges but rejects even one shared culture/service cell", () => {
    const plants = culture({ width: 2, height: 2 });
    const jars = service({ x: 2, height: 2 });
    expect(validateKqWarehouseServiceZones([jars], [plants])).toEqual([]);
    expect(validateKqWarehouseState({ ...empty, zones: [plants], serviceZones: [jars] })).toEqual([]);
    expect(isKqWarehouseState({ ...empty, zones: [plants], serviceZones: [{ ...jars, x: 1 }] })).toBe(false);
    expect(isKqWarehouseState({ ...empty, zones: [{ ...plants, active: false }], serviceZones: [{ ...jars, x: 1 }] })).toBe(false);
  });

  it("rejects drying/storage overlap and identifiers reused by any room", () => {
    const nets = service({ id: "drying", kind: "drying", deviceCode: "SJ-DRYIT90" });
    expect(validateKqWarehouseServiceZones([nets, service()])).not.toEqual([]);
    expect(validateKqWarehouseServiceZones([nets, service({ x: 2 })])).toEqual([]);
    expect(validateKqWarehouseServiceZones([nets, service({ id: "drying", x: 2 })])).not.toEqual([]);
    expect(validateKqWarehouseServiceZones([service({ id: "culture" })], [culture()])).not.toEqual([]);
  });

  it("allocates all 1,000 cells exactly and accepts the final cell at 39,24", () => {
    const plan = paid([service({ x: 39, y: 0, height: 25 })], [culture({ width: 39, height: 25, active: false })]);
    expect(getKqWarehouseSummary(plan)).toMatchObject({
      cultureAreaM2: 975, storageAreaM2: 25, allocatedAreaM2: 1_000, freeAreaM2: 0,
    });
    expect(plan.preparedAreaM2).toBe(1_000);
    expect(validateKqWarehouseServiceZones([service({ x: 39, y: 24 })])).toEqual([]);
    expect(validateKqWarehouseServiceZones([service({ x: 39, y: 24, width: 2 })])).not.toEqual([]);
    expect(validateKqWarehouseServiceZones([service({ x: 39, y: 24, height: 2 })])).not.toEqual([]);
  });

  it.each([
    { x: -1 }, { y: -1 }, { x: 0.5 }, { y: 0.5 }, { width: 0 }, { height: 0 },
    { width: 1.5 }, { height: 1.5 }, { width: 41 }, { height: 26 }, { x: 40 }, { y: 25 },
    { x: NaN }, { width: Infinity }, { height: Number.MAX_SAFE_INTEGER + 1 },
  ])("rejects service geometry that cannot represent whole in-bounds cells: %j", patch => {
    expect(validateKqWarehouseServiceZones([service(patch)])).not.toEqual([]);
    expect(() => getKqWarehouseServiceZoneQuote(service(patch))).toThrow();
  });

  it.each([
    { kind: "storage", deviceCode: "SJ-DRYIT90" },
    { kind: "drying", deviceCode: "LP-SUPER-1L" },
    { kind: "drying", deviceCode: "MH-TS1000" },
    { kind: "storage", deviceCode: "GV-GP50-7" },
    { kind: "storage", deviceCode: "invented" },
    { kind: "culture", deviceCode: "MH-TS1000" },
  ])("rejects an incompatible service device: %j", patch => {
    expect(validateKqWarehouseServiceZones([{ ...service(), ...patch }])).not.toEqual([]);
  });

  it("rejects malformed service collections and empty names instead of hiding them", () => {
    for (const serviceZones of [null, undefined, {}, [null], [service({ name: " " })], [service({ id: "" })]]) {
      expect(isKqWarehouseState({ ...empty, serviceZones })).toBe(false);
    }
  });
});

describe("service installation buys whole physical equipment at current game catalog prices", () => {
  // Post-harvest prices match 20261018000600_kq_postharvest_prices_and_climate_billing.sql.
  it.each([
    { code: "SJ-DRYIT90", kind: "drying" as const, quantity: 1, capacity: 1_000, litres: 0, equipmentCents: 14_900, installationCents: 2_235, totalCents: 29_135 },
    { code: "LP-SUPER-1L", kind: "storage" as const, quantity: 4, capacity: 1_200, litres: 24, equipmentCents: 11_960, installationCents: 1_794, totalCents: 25_754 },
    { code: "CURTEC-60L", kind: "storage" as const, quantity: 4, capacity: 12_000, litres: 240, equipmentCents: 359_600, installationCents: 53_940, totalCents: 425_540 },
    { code: "BROR-JARS-48", kind: "storage" as const, quantity: 1, capacity: 2_400, litres: 48, equipmentCents: 64_900, installationCents: 9_735, totalCents: 86_635 },
  ])("prices and equips a 1 m² $code installation", item => {
    const zone = service({ kind: item.kind, deviceCode: item.code });
    const quote = getKqWarehouseServiceZoneQuote(zone);
    expect(quote.devices.map(device => [device.code, device.quantity])).toEqual([[item.code, item.quantity]]);
    expect(quote).toMatchObject({ areaM2: 1, capacityGrams: item.capacity, capacityGramsPerM2: item.capacity,
      volumeLitres: item.litres, equipmentCostCents: item.equipmentCents, preparationCostCents: 12_000,
      installationCostCents: item.installationCents, totalCostCents: item.totalCents, costPerM2Cents: item.totalCents });
    const purchase = getKqWarehouseQuote({ ...empty, serviceZones: [zone] }, empty);
    expect(purchase.totalCostCents).toBe(item.totalCents);
    expect(purchase.nextState.equipment).toEqual([{ code: item.code, quantity: item.quantity }]);
    expect(getKqWarehouseSummary(purchase.nextState)[item.kind === "drying" ? "dryingCapacityGrams" : "storageCapacityGrams"]).toBe(item.capacity);
  });

  it("distinguishes mesh area from occupied floor and sums nets across zones", () => {
    const nets = service({ id: "drying", kind: "drying", deviceCode: "SJ-DRYIT90", width: 2 });
    const quote = getKqWarehouseServiceZoneQuote(nets);
    expect(quote).toMatchObject({ areaM2: 2, usableSurfaceM2: 5.027, capacityGrams: 2_000,
      equipmentCostCents: 29_800, installationCostCents: 4_470, preparationCostCents: 24_000, totalCostCents: 58_270 });
    expect(getKqWarehouseEquipmentDemand([], [nets, { ...nets, id: "drying-2", x: 4, width: 1 }]))
      .toEqual([{ code: "SJ-DRYIT90", quantity: 3 }]);
  });

  it("charges only added preparation and devices when a storage rectangle grows", () => {
    const original = paid([service()]);
    const quote = getKqWarehouseQuote({ ...original, serviceZones: [service({ width: 2 })] }, original);
    expect(quote).toMatchObject({ addedAreaM2: 1, equipmentCostCents: 11_960, preparationCostCents: 12_000,
      installationCostCents: 1_794, totalCostCents: 25_754 });
    expect(quote.purchases.map(line => [line.code, line.quantity])).toEqual([["LP-SUPER-1L", 4]]);
    expect(quote.nextState.equipment).toEqual([{ code: "LP-SUPER-1L", quantity: 8 }]);
    expect(getKqWarehouseSummary(quote.nextState).storageCapacityGrams).toBe(2_400);
  });

  it("places removed drying and storage equipment in reserve without preserving its usable capacity", () => {
    const original = paid([service(), service({ id: "drying", x: 3, kind: "drying", deviceCode: "SJ-DRYIT90" })]);
    const removed = getKqWarehouseQuote({ ...empty }, original);
    expect(removed.totalCostCents).toBe(0);
    expect(removed.nextState.preparedAreaM2).toBe(2);
    expect(removed.nextState.equipment).toEqual(original.equipment);
    expect(getKqWarehouseSummary(removed.nextState)).toMatchObject({
      allocatedAreaM2: 0, freeAreaM2: 1_000, dryingCapacityGrams: 0, storageCapacityGrams: 0,
      reserve: original.equipment,
    });
    const restored = getKqWarehouseQuote({ ...removed.nextState, serviceZones: original.serviceZones!.map(zone => ({ ...zone, y: 20 })) }, removed.nextState);
    expect(restored.totalCostCents).toBe(0);
    expect(restored.purchases).toEqual([]);
    expect(getKqWarehouseSummary(restored.nextState)).toMatchObject({ dryingCapacityGrams: 1_000, storageCapacityGrams: 1_200, reserve: [] });
  });

  it("reuses previous containers after replacing them and never grants a cash refund", () => {
    const jars = paid([service()]);
    const drums = getKqWarehouseQuote({ ...jars, serviceZones: [service({ deviceCode: "CURTEC-60L" })] }, jars);
    expect(drums.totalCostCents).toBe(413_540);
    expect(drums.purchases.map(line => [line.code, line.quantity])).toEqual([["CURTEC-60L", 4]]);
    expect(getKqWarehouseSummary(drums.nextState)).toMatchObject({ storageCapacityGrams: 12_000, reserve: [{ code: "LP-SUPER-1L", quantity: 4 }] });
    const restored = getKqWarehouseQuote({ ...drums.nextState, serviceZones: [service()] }, drums.nextState);
    expect(restored.totalCostCents).toBe(0);
    expect(getKqWarehouseSummary(restored.nextState)).toMatchObject({ storageCapacityGrams: 1_200, reserve: [{ code: "CURTEC-60L", quantity: 4 }] });
  });

  it("does not count separately owned unplaced equipment as installed capacity", () => {
    const plan = getKqWarehouseQuote({ ...empty, serviceZones: [service()], equipment: [{ code: "LP-SUPER-1L", quantity: 10 }] }).nextState;
    expect(getKqWarehouseSummary(plan)).toMatchObject({ storageCapacityGrams: 1_200, reserve: [{ code: "LP-SUPER-1L", quantity: 6 }] });
  });

  it("spreads the full investment over every fitted square metre, including service-only plans", () => {
    expect(getKqWarehouseSummary(paid([service()]))).toMatchObject({ investmentCents: 25_754, investmentPerM2Cents: 25_754 });
    expect(getKqWarehouseSummary(paid([service()], [culture()]))).toMatchObject({
      allocatedAreaM2: 2, investmentCents: 72_024, investmentPerM2Cents: 36_012,
    });
  });

  it("funds every newly allocated square metre and rejects a forged prepaid-area shortcut", () => {
    const previous = paid([], [culture()]);
    const next = getKqWarehouseQuote({ ...previous, preparedAreaM2: 1_000,
      serviceZones: [service(), service({ id: "drying", x: 3, width: 2, kind: "drying", deviceCode: "SJ-DRYIT90" })] }, previous);
    expect(next).toMatchObject({ addedAreaM2: 3, preparationCostCents: 36_000 });
    expect(next.nextState.preparedAreaM2).toBe(4);
    const unpaidArea = { ...next.nextState, preparedAreaM2: 1 };
    expect(() => getKqWarehouseRunSnapshot(unpaidArea)).toThrow(/financé/);
    const unpaidDevices = { ...next.nextState, equipment: next.nextState.equipment.filter(item => item.code !== "LP-SUPER-1L") };
    expect(() => getKqWarehouseRunSnapshot(unpaidDevices)).toThrow(/financé/);
  });
});

describe("service plans preserve old saves without allowing a rollback exploit", () => {
  it.each(["SJ-DRYIT90", "LP-SUPER-1L", "CURTEC-60L", "BROR-JARS-48"])("requires service-zone adoption before adding %s to a historical inventory", code => {
    const legacy = getKqWarehouseQuote({ version: 1, zones: [culture()], preparedAreaM2: 0,
      equipment: [{ code: "SJ-DRYIT90", quantity: 1 }, { code: "LP-SUPER-1L", quantity: 1 }] }).nextState;
    const before = structuredClone(legacy);
    const quantity = (legacy.equipment.find(item => item.code === code)?.quantity ?? 0) + 1;
    const candidate = { ...legacy, equipment: [...legacy.equipment.filter(item => item.code !== code), { code, quantity }] };
    expect(() => getKqWarehouseQuote(candidate, legacy)).toThrow(/Trace une zone/);
    expect(legacy).toEqual(before);
    expect(getKqWarehouseSummary(legacy)).toMatchObject({ dryingCapacityGrams: 5_000, storageCapacityGrams: 300 });
  });

  it("keeps historical service devices and allows culture-only expansion without forcing adoption", () => {
    const legacy = getKqWarehouseQuote({ version: 1, zones: [culture()], preparedAreaM2: 0,
      equipment: [{ code: "SJ-DRYIT90", quantity: 1 }, { code: "LP-SUPER-1L", quantity: 1 }] }).nextState;
    const unchanged = getKqWarehouseQuote({ ...legacy, equipment: [] }, legacy);
    expect(unchanged.totalCostCents).toBe(0);
    expect(unchanged.nextState.equipment).toEqual(legacy.equipment);
    expect(unchanged.nextState).not.toHaveProperty("serviceZones");

    const expanded = getKqWarehouseQuote({ ...legacy, equipment: [], zones: [culture({ width: 2 })] }, legacy);
    expect(expanded.purchases.map(line => [line.code, line.quantity])).toEqual([["MH-TS1000", 1]]);
    expect(expanded).toMatchObject({ addedAreaM2: 1, totalCostCents: 29_135 });
    expect(expanded.nextState).not.toHaveProperty("serviceZones");
    expect(expanded.nextState.equipment).toEqual(expect.arrayContaining([
      { code: "SJ-DRYIT90", quantity: 1 }, { code: "LP-SUPER-1L", quantity: 1 },
    ]));
    expect(getKqWarehouseSummary(expanded.nextState)).toMatchObject({
      cultureAreaM2: 2, estimatedHarvestGrams: 500, dryingCapacityGrams: 5_000, storageCapacityGrams: 300,
    });
  });

  it("keeps legacy capacity when the field never existed, then requires actual placement after adoption", () => {
    const legacy: KqWarehouseState = getKqWarehouseQuote({ version: 1, zones: [culture()], preparedAreaM2: 0,
      equipment: [{ code: "SJ-DRYIT90", quantity: 1 }, { code: "LP-SUPER-1L", quantity: 1 }] }).nextState;
    expect(legacy).not.toHaveProperty("serviceZones");
    expect(getKqWarehouseSummary(legacy)).toMatchObject({ dryingCapacityGrams: 5_000, storageCapacityGrams: 300 });
    const oldSnapshot = getKqWarehouseRunSnapshot(legacy, 7);
    expect(isKqWarehouseRunSnapshot(oldSnapshot)).toBe(true);
    expect(oldSnapshot.sourceState).not.toHaveProperty("serviceZones");
    const adopted = getKqWarehouseQuote({ ...legacy, serviceZones: [] }, legacy);
    expect(adopted.totalCostCents).toBe(0);
    expect(adopted.nextState.equipment).toEqual(legacy.equipment);
    expect(getKqWarehouseSummary(adopted.nextState)).toMatchObject({ dryingCapacityGrams: 0, storageCapacityGrams: 0 });
    const rollback = { ...adopted.nextState };
    delete rollback.serviceZones;
    expect(() => getKqWarehouseQuote(rollback, adopted.nextState)).toThrow(/doivent rester présentes/);
    expect(isKqWarehouseRunSnapshot(oldSnapshot)).toBe(true);
  });

  it("clones service rectangles for both paid quotes and frozen run snapshots", () => {
    const draft = createKqWarehouseStarter();
    const quote = getKqWarehouseQuote(draft, draft);
    const snapshot = getKqWarehouseRunSnapshot(quote.nextState, 12);
    const before = structuredClone(snapshot);
    draft.serviceZones![0].width = 10;
    expect(quote.nextState.serviceZones![0].width).toBe(1);
    quote.nextState.serviceZones![0].width = 5;
    quote.nextState.serviceZones!.push(service({ id: "extra", x: 20, y: 20 }));
    expect(snapshot).toEqual(before);
    expect(snapshot.sourceState.serviceZones).toHaveLength(2);
    expect(isKqWarehouseRunSnapshot(snapshot)).toBe(true);
    expect(isKqWarehouseRunSnapshot({ ...snapshot, sourceState: { ...snapshot.sourceState, serviceZones: [] } })).toBe(false);
  });

  it("larger stores remove a storage bottleneck without creating production, energy or buyers", () => {
    const small = createKqWarehouseStarter();
    const large = getKqWarehouseQuote({ ...small, serviceZones: small.serviceZones!.map(zone => zone.kind === "storage"
      ? { ...zone, deviceCode: "CURTEC-60L", width: 2 } : zone) }, small).nextState;
    const smallSummary = getKqWarehouseSummary(small), largeSummary = getKqWarehouseSummary(large);
    expect(largeSummary.estimatedHarvestGrams).toBe(250);
    expect(largeSummary.energyKwh).toBe(smallSummary.energyKwh);
    expect(largeSummary.operatingCostCents).toBe(smallSummary.operatingCostCents);
    const forecast = (plan: KqWarehouseState) => {
      const summary = getKqWarehouseSummary(plan);
      return projectKqWarehouseChain({ harvestGrams: summary.estimatedHarvestGrams, stockFlowerGrams: 1_000,
        dryingCapacityGrams: summary.dryingCapacityGrams, storageCapacityGrams: summary.storageCapacityGrams,
        processingCapacityGramsPerHour: 0, flowerDemandGrams: 100, periodDays: 1, dryingDurationDays: 0.25 });
    };
    expect(forecast(small)).toMatchObject({ harvestGrams: 250, soldFlowerGrams: 100, closingStockGrams: 1_150, storageOverflowGrams: 50 });
    expect(forecast(large)).toMatchObject({ harvestGrams: 250, soldFlowerGrams: 100, closingStockGrams: 1_150, storageOverflowGrams: 0 });
  });
});
