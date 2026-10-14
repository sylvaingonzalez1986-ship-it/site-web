import { describe, expect, it } from "vitest";
import { createKqWarehouseStarter, getKqWarehouseQuote, getKqWarehouseRunSnapshot, getKqWarehouseZoneQuote, isKqWarehouseRunSnapshot, isKqWarehouseState } from "./kanab-quest-warehouse";

function warehouse() {
  const initial = createKqWarehouseStarter();
  return getKqWarehouseQuote({ ...initial, zones: [
    { ...initial.zones[0], buddieCode: "HH2026-001" },
    { ...initial.zones[0], id: "second", x: 3, width: 2, buddieCode: "HH2026-002" },
  ] }, initial).nextState;
}

describe("independent warehouse cultures", () => {
  it("charges and forecasts only the selected zone, while keeping the complete frozen plan and shared capacities", () => {
    const state = warehouse();
    const first = getKqWarehouseRunSnapshot(state, 7, "starter");
    const second = getKqWarehouseRunSnapshot(state, 7, "second");
    const legacy = getKqWarehouseRunSnapshot(state, 7);
    expect(first).toMatchObject({ version: 2, zoneId: "starter", revision: 7, activeAreaM2: 1 });
    expect(second.activeAreaM2).toBe(2);
    for (const snapshot of [first, second]) {
      const quote = getKqWarehouseZoneQuote(snapshot.zones[0]);
      expect(snapshot.energyCostCents).toBe(quote.energyCostCents);
      expect(snapshot.consumablesCostCents).toBe(quote.consumablesCostCents);
      expect(snapshot.estimatedHarvestGrams).toBe(quote.estimatedHarvestGrams);
      expect(snapshot.sourceState).toEqual(state);
      expect(snapshot.zones).toHaveLength(1);
      expect(snapshot.dryingCapacityGrams).toBe(legacy.dryingCapacityGrams);
      expect(snapshot.storageCapacityGrams).toBe(legacy.storageCapacityGrams);
      expect(isKqWarehouseRunSnapshot(snapshot)).toBe(true);
    }
    expect(first.operatingCostCents + second.operatingCostCents).toBe(legacy.operatingCostCents);
    state.zones[0].buddieCode = "HH2026-003";
    state.zones[1].width = 4;
    state.serviceZones![0].width = 3;
    expect(first.sourceState.zones[0].buddieCode).toBe("HH2026-001");
    expect(second.zones[0].width).toBe(2);
    expect(first.sourceState.serviceZones![0].width).toBe(1);
  });

  it("preserves legacy snapshots and rejects forged or mismatched zone snapshots", () => {
    const state = warehouse();
    const legacy = getKqWarehouseRunSnapshot(state);
    const zone = getKqWarehouseRunSnapshot(state, 0, "starter");
    expect(legacy.version).toBe(1);
    expect(isKqWarehouseRunSnapshot(legacy)).toBe(true);
    expect(isKqWarehouseRunSnapshot({ ...legacy, zoneId: "starter" })).toBe(false);
    expect(isKqWarehouseRunSnapshot({ ...zone, zoneId: "second" })).toBe(false);
    expect(isKqWarehouseRunSnapshot({ ...zone, version: "2" })).toBe(false);
    expect(isKqWarehouseRunSnapshot({ ...zone, energyCostCents: legacy.energyCostCents })).toBe(false);
    expect(isKqWarehouseRunSnapshot({ ...zone, zones: legacy.zones })).toBe(false);
    expect(isKqWarehouseRunSnapshot({ ...zone, zoneId: undefined })).toBe(false);
  });

  it("requires an active, funded culture zone and validates optional Buddie assignments", () => {
    const state = warehouse();
    expect(() => getKqWarehouseRunSnapshot(state, 0, "missing")).toThrow();
    expect(() => getKqWarehouseRunSnapshot(state, 0, "starter-storage")).toThrow();
    state.zones[0].active = false;
    expect(() => getKqWarehouseRunSnapshot(state, 0, "starter")).toThrow();
    expect(() => getKqWarehouseRunSnapshot({ ...state, equipment: [] }, 0, "second")).toThrow(/financé/);
    for (const buddieCode of ["", "HH2026-000", "HH2026-053", "BOTTE-001", null]) {
      expect(isKqWarehouseState({ ...state, zones: [{ ...state.zones[1], buddieCode }] })).toBe(false);
    }
  });
});
