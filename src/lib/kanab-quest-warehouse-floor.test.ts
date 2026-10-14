import { describe, expect, it } from "vitest";
import { startKqGame } from "./kanab-quest-game";
import { encodeKqSave, parseKqGameSave } from "./kanab-quest-persistence";
import { compactKqWarehouseToStarterFloor, createKqWarehouseStarter, getKqWarehouseDimensions,
  getKqWarehouseQuote, getKqWarehouseRunSnapshot, getKqWarehouseSummary, isKqWarehouseRunSnapshot,
  isKqWarehouseState, type KqWarehouseState } from "./kanab-quest-warehouse";

const legacy = (): KqWarehouseState => {
  const state = createKqWarehouseStarter();
  delete state.floor;
  state.serviceZones = state.serviceZones!.map(zone => ({ ...zone, y: 24 }));
  return state;
};
const identity = (state: KqWarehouseState) => ({ ...state, floor: undefined,
  zones: state.zones.map(zone => ({ ...zone, x: 0, y: 0 })),
  serviceZones: state.serviceZones?.map(zone => ({ ...zone, x: 0, y: 0 })),
});

describe("100 m² premises and immutable historical floors", () => {
  it("starts with 100 cells, three funded cells and the same capacities and investment", () => {
    const starter = createKqWarehouseStarter(), old = legacy();
    expect(getKqWarehouseDimensions()).toEqual({ columns: 10, rows: 10 });
    expect(getKqWarehouseDimensions(starter)).toEqual({ columns: 10, rows: 10 });
    expect(getKqWarehouseDimensions(old)).toEqual({ columns: 40, rows: 25 });
    expect(getKqWarehouseSummary(starter)).toEqual({ ...getKqWarehouseSummary(old), totalAreaM2: 100, freeAreaM2: 97 });
    expect(starter.preparedAreaM2).toBe(3);
    expect(starter.serviceZones!.map(zone => zone.y)).toEqual([9, 9]);
  });

  it.each([{ columns: 40, rows: 25 }, { columns: 10, rows: 11 }, { columns: 10, rows: 10, free: true }, null])("rejects an invented floor %j", floor => {
    expect(isKqWarehouseState({ ...createKqWarehouseStarter(), floor })).toBe(false);
  });

  it("checks both culture and service edges against the actual floor", () => {
    const state = { ...createKqWarehouseStarter(), serviceZones: [] };
    expect(isKqWarehouseState({ ...state, zones: state.zones.map(zone => ({ ...zone, x: 9, y: 9 })) })).toBe(true);
    expect(isKqWarehouseState({ ...state, zones: state.zones.map(zone => ({ ...zone, x: 10 })) })).toBe(false);
    expect(isKqWarehouseState({ ...state, serviceZones: legacy().serviceZones })).toBe(false);
    expect(isKqWarehouseState({ ...state, preparedAreaM2: 101 })).toBe(false);
    expect(isKqWarehouseState({ ...legacy(), preparedAreaM2: 101 })).toBe(true);
  });

  it("never allows a quote to grant a larger floor or silently convert an old one", () => {
    const state = createKqWarehouseStarter(), removed = { ...state }; delete removed.floor;
    expect(() => getKqWarehouseQuote(removed, state)).toThrow("dimensions");
    expect(() => getKqWarehouseQuote(state, removed)).toThrow("dimensions");
    expect(getKqWarehouseQuote(state, state)).toMatchObject({ totalCostCents: 0, nextState: { floor: state.floor } });
  });

  it("moves only displaced rectangles and preserves IDs, Buddies, funding and all reserves", () => {
    const state = legacy();
    state.zones[0].buddieCode = "HH2026-003";
    state.optionInventory = [{ code: "SIM-NUTRITION-01", quantity: 17 }];
    state.equipment[0].quantity += 5;
    state.preparedAreaM2 = 85;
    const frozen = JSON.stringify(state), result = compactKqWarehouseToStarterFloor(state)!;
    expect(result).not.toBeNull();
    expect(identity(result)).toEqual(identity(state));
    expect(result.zones).toEqual(state.zones);
    expect(result.serviceZones!.map(zone => zone.y)).toEqual([9, 9]);
    expect(JSON.stringify(state)).toBe(frozen);
    expect(getKqWarehouseSummary(result)).toEqual({ ...getKqWarehouseSummary(state), totalAreaM2: 100, freeAreaM2: 97 });
    expect(compactKqWarehouseToStarterFloor(result)).toBeNull();
  });

  it("finds another free cell if the preferred relocated position is occupied", () => {
    const state = legacy();
    state.zones[0].y = 9;
    const result = compactKqWarehouseToStarterFloor(state)!;
    expect(result.serviceZones!.find(zone => zone.kind === "drying")).toMatchObject({ x: 0, y: 0 });
    expect(isKqWarehouseState(result)).toBe(true);
  });

  it("keeps historical absence of service zones and their inventory-derived capacities", () => {
    const state = legacy(); delete state.serviceZones;
    const result = compactKqWarehouseToStarterFloor(state)!;
    expect(result).not.toHaveProperty("serviceZones");
    expect(getKqWarehouseSummary(result).storageCapacityGrams).toBe(getKqWarehouseSummary(state).storageCapacityGrams);
  });

  it("leaves excessive funded area, large rectangles and impossible conservative packing untouched", () => {
    const state = legacy();
    for (const candidate of [
      { ...state, preparedAreaM2: 101 },
      { ...state, zones: state.zones.map(zone => ({ ...zone, width: 11 })) },
      { ...state, serviceZones: [], zones: [
        { ...state.zones[0], y: 5, width: 10 },
        { ...state.zones[0], id: "large", x: 20, width: 6, height: 6 },
      ] },
    ]) {
      const frozen = JSON.stringify(candidate);
      expect(compactKqWarehouseToStarterFloor(candidate)).toBeNull();
      expect(JSON.stringify(candidate)).toBe(frozen);
    }
  });

  it("keeps archived 1,000 m² snapshots valid and freezes the new floor independently", () => {
    const old = legacy(); old.zones[0].x = 39;
    const historical = getKqWarehouseRunSnapshot(old, 4);
    const historicalGame = startKqGame(300, { warehouse: historical });
    expect(parseKqGameSave(encodeKqSave(historicalGame))).toEqual(historicalGame);
    expect(isKqWarehouseRunSnapshot(JSON.parse(JSON.stringify(historical)))).toBe(true);
    expect(historical.sourceState).not.toHaveProperty("floor");
    const starter = createKqWarehouseStarter(), snapshot = getKqWarehouseRunSnapshot(starter, 2, "starter");
    expect(snapshot.sourceState.floor).not.toBe(starter.floor);
    expect(isKqWarehouseRunSnapshot(snapshot)).toBe(true);
    expect(compactKqWarehouseToStarterFloor(old)).not.toBeNull();
    expect(historical.sourceState.zones[0].x).toBe(39);
  });
});
