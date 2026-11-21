import { describe, expect, it } from "vitest";
import retail from "./kanab-quest-warehouse-retail-equipment.json";
import { getKqWarehouseAirCoverage, getKqWarehouseAirMounts, getKqWarehouseAirPlacements, getKqWarehouseAirReach, validateKqWarehouseAirPlacements, type KqWarehouseAirPlacement } from "./kanab-quest-warehouse-air";
import { getKqWarehouseOption, getKqWarehouseZoneModuleEffect } from "./kanab-quest-warehouse-options";
import { createKqWarehouseEmpty, createKqWarehouseStarter, getKqWarehouseQuote, getKqWarehouseRunSnapshot, getKqWarehouseSummary, getKqWarehouseZoneQuote, isKqWarehouseRunSnapshot, KQ_WAREHOUSE_UNLIT_CODE, validateKqWarehouseState } from "./kanab-quest-warehouse";
import { getKqCampaignParticipants } from "./kanab-quest-campaign";
import { initializeKqWarehouseCondition, reconcileKqWarehouseCondition } from "./kanab-quest-warehouse-condition";

const economy = "SIM-AIR-01";
const standard = "SJ-DF16E350";
const premium = "SIM-AIR-03";
const starter = createKqWarehouseStarter();
const zone = starter.zones[0];

describe("warehouse ventilation", () => {
  it("converts the historical requirement without rebuying devices or resetting the starter output", () => {
    const airPlacements = getKqWarehouseAirPlacements(starter);
    const quote = getKqWarehouseQuote({ ...starter, airPlacements,
      airService: { starter: { coveredAreaM2: 99, qualityPoints: 99, powerMilliWatts: 0 } },
    }, starter);
    expect(airPlacements).toEqual([{ id: "air-legacy-0-0", x: 0, y: 0, code: standard }]);
    expect(quote.totalCostCents).toBe(0);
    expect(getKqWarehouseSummary(quote.nextState)).toEqual(getKqWarehouseSummary(starter));
    expect(quote.nextState.airService?.starter).toEqual({ coveredAreaM2: 1, qualityPoints: 1, powerMilliWatts: 35000 });
    expect(createKqWarehouseStarter(true).airService).toEqual(quote.nextState.airService);
  });

  it("covers more than one zone and freezes each zone's share of an extractor in its run", () => {
    const state = getKqWarehouseQuote({
      ...starter,
      zones: [zone, { ...zone, id: "second", x: 1 }, { ...zone, id: "paused", x: 2, active: false }],
      airPlacements: [{ id: "extractor", x: 1, y: 0, code: standard }],
    }, starter).nextState;
    const coverage = getKqWarehouseAirCoverage(state)!;
    expect(coverage.placements).toEqual([expect.objectContaining({ coveredAreaM2: 3, powerWatts: 35 })]);
    expect(coverage.zones.paused.powerWatts).toBe(0);
    expect(getKqWarehouseSummary(state).energyKwh).toBe(350.4);
    for (const id of ["starter", "second"]) {
      const snapshot = getKqWarehouseRunSnapshot(state, 1, id);
      expect(snapshot).toMatchObject({ powerWatts: 167.5, energyKwh: 175.2, estimatedHarvestGrams: 250, qualityBonus: 1 });
      expect(isKqWarehouseRunSnapshot(snapshot)).toBe(true);
      expect(isKqWarehouseRunSnapshot({ ...snapshot, sourceState: { ...snapshot.sourceState, airService: {} } })).toBe(false);
    }
  });

  it("respects the reach, capacity and partitions of an economical extractor", () => {
    const airPlacements = [{ id: "economy", x: 0, y: 0, code: economy }];
    const plan = { ...starter, zones: [{ ...zone, x: 2, width: 5 }, { ...zone, id: "near", x: 0, y: 1, width: 4, height: 2 }], airPlacements };
    const reach = getKqWarehouseAirCoverage(plan)!;
    expect(reach.zones.starter.coveredAreaM2).toBe(2);
    expect(reach.placements[0]).toMatchObject({ capacityM2: 8, coveredAreaM2: 7, rangeM: 3 });
    const partitions = [{ id: "wall", x: 1, y: 0, axis: "x" as const, length: 1 }];
    const blocked = getKqWarehouseQuote({ ...plan, partitions }, starter).nextState;
    expect(getKqWarehouseAirCoverage(blocked)?.zones.starter.coveredAreaM2).toBe(0);
    const withoutAir = getKqWarehouseQuote({ ...plan, airPlacements: [] }, starter).nextState;
    const withAir = getKqWarehouseQuote(plan, starter).nextState;
    expect(getKqWarehouseSummary(withAir).estimatedHarvestGrams).toBeGreaterThan(getKqWarehouseSummary(withoutAir).estimatedHarvestGrams);
    expect(getKqWarehouseSummary(withAir).qualityBonus).toEqual(getKqWarehouseSummary(withoutAir).qualityBonus);
  });

  it("favours the strongest tier per square metre and keeps redundant units idle", () => {
    const draft = { ...starter, airPlacements: [
      { id: "economy", x: 0, y: 0, code: economy },
      { id: "premium", x: 1, y: 0, code: premium },
    ] };
    const coverage = getKqWarehouseAirCoverage(draft)!;
    expect(coverage.cells[0]).toMatchObject({ placementId: "premium", code: premium });
    expect(coverage.zones.starter).toMatchObject({ coveredAreaM2: 1, qualityBonus: 2, powerWatts: 55 });
    expect(coverage.placements.find(item => item.id === "economy")?.powerWatts).toBe(0);
    const installed = getKqWarehouseQuote(draft, starter);
    expect(installed.purchases.map(item => item.code)).toEqual([economy, premium]);
    expect(() => getKqWarehouseRunSnapshot(draft)).toThrow("financé");
    const moved = getKqWarehouseQuote({ ...installed.nextState,
      airPlacements: draft.airPlacements.map(item => item.id === "premium" ? { ...item, x: 9, y: 9 } : item),
    }, installed.nextState);
    expect(moved.totalCostCents).toBe(0);
    expect(getKqWarehouseAirCoverage(moved.nextState)?.cells[0].placementId).toBe("economy");
    const removed = getKqWarehouseQuote({ ...installed.nextState, airPlacements: [] }, installed.nextState);
    expect(removed.totalCostCents).toBe(0);
    expect(getKqWarehouseSummary(removed.nextState).reserve).toEqual(expect.arrayContaining([
      { code: economy, quantity: 1 }, { code: premium, quantity: 1 }, { code: standard, quantity: 1 },
    ]));
  });

  it("rejects invalid positions, collisions and non-ventilation devices", () => {
    const placement = { id: "first", x: 2, y: 0, code: standard };
    expect(validateKqWarehouseState({ ...starter, airPlacements: [placement] })).toEqual([]);
    expect(validateKqWarehouseState({ ...starter, airPlacements: [placement, { ...placement, id: "second" }] })).not.toEqual([]);
    expect(validateKqWarehouseState({ ...starter, airPlacements: [{ ...placement, code: zone.lightingCode }] })).not.toEqual([]);
    expect(validateKqWarehouseState({ ...starter, airPlacements: [{ ...placement, x: 10 }] })).not.toEqual([]);
    expect(validateKqWarehouseState({ ...starter, airPlacements: [placement],
      partitions: [{ id: "wall", x: 2, y: 0, axis: "y", length: 2 }],
    })).not.toEqual([]);
  });

  it("exposes the reach of an exterior wall mount on an empty floor", () => {
    const dimensions = { columns: 10, rows: 10 };
    const fan: KqWarehouseAirPlacement = { id: "outside", x: 0, y: 2, code: economy, mount: { kind: "wall", face: "east" } };
    expect(getKqWarehouseAirMounts({ x: 0, y: 0 }, dimensions)).toEqual([{ kind: "wall", face: "east" }, { kind: "wall", face: "south" }]);
    const reach = getKqWarehouseAirReach(fan, dimensions);
    expect(reach).toContainEqual({ x: 3, y: 2 });
    expect(reach).not.toContainEqual({ x: 4, y: 2 });
    expect(validateKqWarehouseAirPlacements([fan], dimensions)).toEqual([]);
    expect(validateKqWarehouseAirPlacements([{ ...fan, x: 1 }], dimensions)).not.toEqual([]);
    expect(validateKqWarehouseAirPlacements([{ ...fan, mount: { kind: "wall", face: "west" } }], dimensions)).not.toEqual([]);
  });

  it("blows away from the supporting partition and stops at other walls", () => {
    const dimensions = { columns: 10, rows: 10 };
    const support = { id: "support", x: 1, y: 3, axis: "x" as const, length: 4 };
    const obstacle = { id: "obstacle", x: 2, y: 5, axis: "x" as const, length: 1 };
    const partitions = [support, obstacle];
    const fan: KqWarehouseAirPlacement = { id: "partition-fan", code: economy, x: 2, y: 3,
      mount: { kind: "wall", face: "south", partitionId: support.id } };
    expect(getKqWarehouseAirMounts(fan, dimensions, partitions).map(mount => mount.face)).toEqual(["north", "south"]);
    expect(validateKqWarehouseAirPlacements([fan], dimensions, partitions)).toEqual([]);
    expect(validateKqWarehouseAirPlacements([fan], dimensions, [{ ...support, y: 2 }, obstacle])).not.toEqual([]);
    expect(validateKqWarehouseAirPlacements([{ ...fan, mount: { kind: "wall", face: "east", partitionId: support.id } }], dimensions, partitions)).not.toEqual([]);
    expect(validateKqWarehouseAirPlacements([fan, { ...fan, id: "duplicate" }], dimensions, partitions)).not.toEqual([]);
    expect(getKqWarehouseAirReach(fan, dimensions, partitions)).toContainEqual({ x: 2, y: 4 });
    expect(getKqWarehouseAirReach(fan, dimensions, partitions)).not.toContainEqual({ x: 2, y: 2 });
    expect(getKqWarehouseAirReach(fan, dimensions, partitions)).not.toContainEqual({ x: 2, y: 6 });
    const plan = getKqWarehouseQuote({ ...createKqWarehouseEmpty(), partitions, airPlacements: [fan], zones: [
      { ...zone, id: "north", x: 2, y: 2 },
      { ...zone, id: "south", x: 2, y: 4 },
      { ...zone, id: "behind", x: 2, y: 6 },
    ] }).nextState;
    expect(plan.airService).toMatchObject({
      north: { coveredAreaM2: 0, powerMilliWatts: 0 },
      south: { coveredAreaM2: 1, powerMilliWatts: 20_000 },
      behind: { coveredAreaM2: 0, powerMilliWatts: 0 },
    });
  });

  it.each([
    ["SIM-LOGISTICS-01", 110, 0], ["SIM-LOGISTICS-03", 310, 0],
    ["SIM-SECURITY-01", 125, 0], ["SIM-SECURITY-02", 250, 0], ["SIM-SECURITY-03", 400, 0],
    ["SIM-HYGIENE-01", 0, 1], ["SIM-HYGIENE-02", 0, 2], ["SIM-HYGIENE-03", 0, 3],
    ["SIM-LOGISTICS-02", 0, 0],
  ])("gives modern module %s its own effect", (code, supplySavingCentsPerM2, qualityBonus) => {
    expect(getKqWarehouseZoneModuleEffect(getKqWarehouseOption(code)!, true))
      .toEqual({ supplySavingCentsPerM2, qualityBonus, yieldBonusPercent: 0 });
  });

  it("deducts zone savings from base supplies and bills the gross module supplies on modern runs", () => {
    const zones = [{ ...zone, width: 2, optionCodes: [
      "SIM-HYGIENE-03", "SIM-LOGISTICS-03", "SIM-SECURITY-03", "SIM-CLIMATE-03", "SIM-WATER-01",
    ] }];
    const legacy = { ...starter, zones, optionInventory: [{ code: "SIM-LOGISTICS-03", quantity: 2 }, { code: "SIM-CLIMATE-03", quantity: 2 }] };
    const old = getKqWarehouseQuote(legacy, legacy).nextState;
    const modern = getKqWarehouseQuote({ ...old, airPlacements: getKqWarehouseAirPlacements(old) }, old).nextState;
    const airCoverage = getKqWarehouseAirCoverage(modern)?.zones.starter;
    const quote = getKqWarehouseZoneQuote(zones[0], 2, undefined, airCoverage);
    expect(quote).toMatchObject({ consumablesCostCents: 4980, yieldBonusPercent: 4, moduleQualityBonus: 4, estimatedHarvestGrams: 520 });
    expect(quote.options.reduce((total, line) => total + line.consumablesCostCents, 0)).toBe(2000);
    expect(getKqWarehouseSummary(modern).consumablesCostCents).toBe(4980);
    const run = getKqWarehouseRunSnapshot(modern, 0, "starter");
    expect(run).toMatchObject({ consumablesCostCents: 4980, qualityBonus: 5, estimatedHarvestGrams: 520 });
    expect(isKqWarehouseRunSnapshot(run)).toBe(true);
    const oldRun = getKqWarehouseRunSnapshot(old, 0, "starter");
    expect(oldRun).toMatchObject({ consumablesCostCents: 6400, estimatedHarvestGrams: 565 });
    expect(isKqWarehouseRunSnapshot(oldRun)).toBe(true);
  });

  it("funds the support before lighting and fits the first complete plan within 1,000 euros", () => {
    const empty = createKqWarehouseEmpty();
    const unlit = { ...zone, lightingCode: KQ_WAREHOUSE_UNLIT_CODE, active: false, buddieCode: "HH2026-002", optionCodes: ["SIM-SUBSTRATE-01"] };
    expect(getKqWarehouseSummary(empty)).toMatchObject({ freeAreaM2: 100, activeAreaM2: 0, investmentCents: 0 });
    const quote = getKqWarehouseQuote({ ...empty, zones: [unlit] }, empty);
    const supportCents = retail["SIM-SUBSTRATE-01"].unitPriceCents;
    expect(quote).toMatchObject({ totalCostCents: 12_000 + supportCents + Math.round(supportCents * 15 / 100),
      purchases: [], optionPurchases: [{ code: "SIM-SUBSTRATE-01", quantity: 1 }] });
    expect(getKqWarehouseSummary(quote.nextState)).toMatchObject({ activeAreaM2: 0, estimatedHarvestGrams: 0, powerWatts: 0, consumablesCostCents: 0 });
    expect(getKqCampaignParticipants(quote.nextState, 1)).toEqual([]);
    expect(() => getKqWarehouseRunSnapshot(quote.nextState, 1, unlit.id)).toThrow("Installe un éclairage");
    expect(validateKqWarehouseState({ ...empty, zones: [{ ...unlit, active: true }] })).not.toEqual([]);
    const installed = getKqWarehouseQuote({ ...quote.nextState, zones: [{ ...unlit, active: true, lightingCode: zone.lightingCode }],
      serviceZones: starter.serviceZones, airPlacements: [{ id: "starter-fan", code: economy, x: 0, y: 0 }],
    }, quote.nextState);
    const equipmentCents = retail["MH-TS1000"].unitPriceCents + retail[economy].unitPriceCents
      + retail["SJ-DRYIT90"].unitPriceCents + 4 * retail["LP-SUPER-1L"].unitPriceCents;
    expect(installed.totalCostCents).toBe(2 * 12_000 + equipmentCents + Math.round(equipmentCents * 15 / 100));
    expect(installed.totalCostCents + quote.totalCostCents).toBeLessThanOrEqual(100_000);
    const setupCondition = initializeKqWarehouseCondition(quote.nextState);
    const condition = reconcileKqWarehouseCondition(quote.nextState, installed.nextState, setupCondition, { requestKey: "onboarding", fundedFraction: 1 });
    expect(getKqCampaignParticipants(installed.nextState, 2, condition)).toHaveLength(1);
  });
});
