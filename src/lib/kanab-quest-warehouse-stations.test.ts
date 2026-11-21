import { describe, expect, it } from "vitest";
import retail from "./kanab-quest-warehouse-retail-equipment.json";
import { initializeKqWarehouseCondition, reconcileKqWarehouseCondition } from "./kanab-quest-warehouse-condition";
import {
  createKqWarehouseEmpty, createKqWarehouseStarter, getKqWarehouseQuote, getKqWarehouseRunSnapshot,
  getKqWarehouseSummary, isKqWarehouseRunSnapshot, validateKqWarehouseState, type KqWarehouseState,
} from "./kanab-quest-warehouse";
import { adoptKqWarehouseStations, getKqWarehouseStationCoverage, getKqWarehouseStationEntrance, getKqWarehouseStationReach } from "./kanab-quest-warehouse-stations";

const water = { id: "water", code: "SIM-WATER-03", x: 5, y: 2 } as const;
const sas = { id: "sas", code: "SIM-HYGIENE-03", x: 5, y: 9 } as const;
const starter = createKqWarehouseStarter(true);
const empty = createKqWarehouseEmpty();
const patch = { ...starter.zones[0], id: "bed", x: 5, y: 6, width: 4, height: 1 };

describe("warehouse service stations", () => {
  it("funds irrigation flooring and installation and fits the airlock to the existing entrance", () => {
    const draft = { ...empty, stationPlacements: [water, sas] };
    const paid = getKqWarehouseQuote(draft, empty);
    expect(() => getKqWarehouseQuote({ ...draft, optionInventory: [{ code: water.code, quantity: 2 }] }, empty)).toThrow(/Place les nouveaux postes/);
    const waterCost = retail[water.code].unitPriceCents, hygieneCost = retail[sas.code].unitPriceCents;
    const equipmentCostCents = waterCost + hygieneCost;
    const installationCostCents = Math.round(waterCost * 15 / 100);
    expect(paid).toMatchObject({ addedAreaM2: 1, preparationCostCents: 12_000, equipmentCostCents, installationCostCents,
      totalCostCents: 12_000 + equipmentCostCents + installationCostCents, optionPurchases: expect.arrayContaining([
        expect.objectContaining({ code: water.code, quantity: 1, totalCents: waterCost, unit: "station" }),
        expect.objectContaining({ code: sas.code, quantity: 1, totalCents: hygieneCost, unit: "station" }),
      ]) });
    expect(getKqWarehouseSummary(paid.nextState)).toMatchObject({ allocatedAreaM2: 2, optionReserve: [] });
    const release = getKqWarehouseQuote({ ...paid.nextState, stationPlacements: [] }, paid.nextState);
    expect(release.totalCostCents).toBe(0);
    expect(getKqWarehouseSummary(release.nextState).optionReserve).toEqual(paid.nextState.optionInventory);
  });

  it("respects reach, the south threshold, collisions and local options", () => {
    expect(getKqWarehouseStationEntrance({ columns: 10, rows: 10 })).toEqual({ x: 5, y: 9 });
    const wall = { id: "wall", axis: "x", x: 4, y: 4, length: 4 } as const;
    expect(getKqWarehouseStationReach(water, { columns: 10, rows: 10 }, [wall])).not.toContainEqual({ x: 5, y: 6 });
    const draft = { ...empty, zones: [patch], stationPlacements: [water, sas] };
    expect(getKqWarehouseStationCoverage(draft)?.zones.bed).toEqual({ waterAreaM2: 3, hygieneAreaM2: 4 });
    expect(getKqWarehouseStationCoverage({ ...draft, partitions: [wall] })?.zones.bed.waterAreaM2).toBe(0);
    expect(getKqWarehouseStationCoverage({ ...draft, zones: [{ ...patch, optionCodes: ["SIM-WATER-02"] }] })?.zones.bed.waterAreaM2).toBe(0);
    expect(getKqWarehouseStationCoverage({ ...draft, stationPlacements: [water, { ...water, id: "second", x: 6 }, sas] })?.zones.bed.waterAreaM2).toBe(4);
    for (const invalid of [
      { ...draft, stationPlacements: [{ ...sas, x: 4 }] },
      { ...draft, stationPlacements: [sas, { ...sas, id: "other" }] },
      { ...draft, stationPlacements: [{ ...water, y: 6 }] },
      { ...draft, airPlacements: [{ ...water, id: "fan", code: "SIM-AIR-01" }] },
      { ...draft, zones: [{ ...patch, optionCodes: [water.code] }] },
    ]) expect(validateKqWarehouseState(invalid)).not.toHaveLength(0);
  });

  it("scales recurring effects to the served area and freezes whole-floor shares in a selected-zone run", () => {
    const fitted = getKqWarehouseQuote({ ...empty, zones: [patch], stationPlacements: [water, sas] }).nextState;
    const run = getKqWarehouseRunSnapshot(fitted, 1, patch.id);
    expect(run.sourceState.stationService).toEqual({ bed: { waterAreaM2: 3, hygieneAreaM2: 4 } });
    expect(run).toMatchObject({ activeAreaM2: 4, estimatedHarvestGrams: 766.875, consumablesCostCents: 10560, qualityBonus: 3 });
    expect(isKqWarehouseRunSnapshot(run)).toBe(true);
    expect(isKqWarehouseRunSnapshot({ ...run, sourceState: { ...run.sourceState, stationService: {} } })).toBe(false);
  });

  it("reassigns funded historical units at their existing paid basis and keeps old runs valid", () => {
    const legacy = getKqWarehouseQuote({ ...starter, zones: [{ ...patch, optionCodes: [water.code, sas.code] }] }).nextState;
    const historicalRun = getKqWarehouseRunSnapshot(legacy);
    let ordinal = 0;
    const id = () => `asset-${++ordinal}`;
    const condition = initializeKqWarehouseCondition(legacy, false, id);
    condition.assets.find(asset => asset.code === water.code)!.purchaseUnitCents = 2500;
    condition.assets.find(asset => asset.code === water.code)!.wearPercent = 17;
    const draft: KqWarehouseState = { ...adoptKqWarehouseStations(legacy), stationPlacements: [water, sas] };
    const quote = getKqWarehouseQuote(draft, legacy);
    expect(quote.optionPurchases).toEqual([]);
    expect(quote.nextState.optionInventory).toEqual(legacy.optionInventory);
    const moved = reconcileKqWarehouseCondition(legacy, quote.nextState, condition, { requestKey: "conversion", fundedFraction: 1 }, id);
    expect(moved.assets.find(asset => asset.code === water.code)).toMatchObject({
      purchaseUnitCents: 2500, wearPercent: 17, zoneId: null, quantity: 4,
    });
    expect(getKqWarehouseSummary(quote.nextState).optionReserve.find(item => item.code === water.code)?.quantity).toBe(3);
    expect(isKqWarehouseRunSnapshot(historicalRun)).toBe(true);
  });
});
