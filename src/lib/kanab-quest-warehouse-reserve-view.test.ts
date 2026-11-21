import { describe, expect, it } from "vitest";
import { KQ_WAREHOUSE_CATALOG } from "./kanab-quest-warehouse-catalog";
import { KQ_WAREHOUSE_OPTIONS } from "./kanab-quest-warehouse-options";
import type { KqWarehouseAsset, KqWarehouseCondition } from "./kanab-quest-warehouse-condition";
import { getKqWarehouseReserveView } from "./kanab-quest-warehouse-reserve-view";
import { createKqWarehouseStarter, getKqWarehouseQuote, getKqWarehouseSummary } from "./kanab-quest-warehouse";

const code = "MH-TS1000";
const summary = { reserve: [{ code, quantity: 4 }], optionReserve: [] };
const asset = (id: string, quantity: number, wearPercent: number, extra: Partial<KqWarehouseAsset> = {}): KqWarehouseAsset => ({
  id, kind: "device", code, quantity, wearPercent, zoneId: null, purchaseUnitCents: null, ...extra,
});
const condition = (...assets: KqWarehouseAsset[]): KqWarehouseCondition => ({ version: 1, assets });

describe("warehouse reserve presentation", () => {
  it("groups the same model by its actual wear, excluding installed equipment", () => {
    const current = condition(asset("first", 1, 20), asset("second", 2, 80), asset("third", 1, 20), asset("installed", 10, 50, { zoneId: "zone" }));
    const original = structuredClone(current);
    expect(getKqWarehouseReserveView(summary, current).hardware[0].wearGroups).toEqual([{ quantity: 2, wearPercent: 20 }, { quantity: 2, wearPercent: 80 }]);
    expect(current).toEqual(original);
  });

  it("distinguishes missing wear from a confirmed new item", () => {
    expect(getKqWarehouseReserveView(summary).hardware[0].wearGroups).toEqual([{ quantity: 4, wearPercent: null }]);
    expect(getKqWarehouseReserveView(summary, null).hardware[0].wearGroups).toEqual([{ quantity: 4, wearPercent: null }]);
    expect(getKqWarehouseReserveView(summary, condition(asset("new", 4, 0))).hardware[0].wearGroups).toEqual([{ quantity: 4, wearPercent: 0 }]);
  });

  it("keeps missing quantities unknown when only part of the reserve is tracked", () => {
    expect(getKqWarehouseReserveView(summary, condition(asset("known", 1, 50))).hardware[0].wearGroups).toEqual([{ quantity: 1, wearPercent: 50 }, { quantity: 3, wearPercent: null }]);
  });

  it("does not display contradictory or invalid condition as reliable wear", () => {
    expect(getKqWarehouseReserveView(summary, condition(asset("too-many", 5, 20))).hardware[0].wearGroups).toEqual([{ quantity: 4, wearPercent: null }]);
    expect(getKqWarehouseReserveView(summary, condition(asset("invalid", 4, 101))).hardware[0].wearGroups).toEqual([{ quantity: 4, wearPercent: null }]);
  });

  it("keeps device counts separate from module coverage and untracked services", () => {
    const option = KQ_WAREHOUSE_OPTIONS[0], service = KQ_WAREHOUSE_CATALOG.find(item => item.kind === "storage")!;
    const view = getKqWarehouseReserveView({ reserve: [...summary.reserve, { code: service.code, quantity: 3 }], optionReserve: [{ code: option.code, quantity: 8 }] }, condition(asset("lamp", 4, 20), asset("module", 8, 80, { kind: "option", code: option.code })));
    expect(view.hardware.map(item => item.quantity)).toEqual([4, 3]);
    expect(view.hardware[1].wearGroups).toBeNull();
    expect(view.modules[0]).toMatchObject({ quantity: 8, wearGroups: [{ quantity: 8, wearPercent: 80 }] });
  });

  it("does not invent reserve lines from the ledger or from zero inventory", () => {
    const view = getKqWarehouseReserveView({ reserve: [{ code, quantity: 0 }], optionReserve: [] }, condition(asset("ledger-only", 4, 20)));
    expect(view).toEqual({ hardware: [], modules: [], stations: [] });
  });

  it("shows whole controllers as devices and previously paid module coverage in square metres", () => {
    const current = "SIM-CONTROL-UNIT-01", legacy = "SIM-CONTROL-01";
    const view = getKqWarehouseReserveView({ reserve: [], optionReserve: [{ code: current, quantity: 1 }, { code: legacy, quantity: 8 }] },
      condition(asset("controller", 1, 12, { kind: "option", code: current })));
    expect(view.hardware).toMatchObject([{ code: current, kind: "control", quantity: 1, wearGroups: [{ quantity: 1, wearPercent: 12 }] }]);
    expect(view.modules.map(({ code, quantity }) => ({ code, quantity }))).toEqual([{ code: legacy, quantity: 8 }]);
  });

  it("counts removed shared stations as units and keeps historical supplies in square metres", () => {
    const starter = createKqWarehouseStarter(true);
    const placed = getKqWarehouseQuote({ ...starter, stationPlacements: [
      { id: "water", code: "SIM-WATER-03", x: 1, y: 1 },
      { id: "hygiene", code: "SIM-HYGIENE-03", x: 5, y: 9 },
    ], optionInventory: [{ code: "SIM-WATER-01", quantity: 2 }] }, starter).nextState;
    const removed = getKqWarehouseQuote({ ...placed, stationPlacements: [] }, placed).nextState;
    const waterCondition = condition(asset("water-stock", 1, 20, { code: "SIM-WATER-03", kind: "option" }));
    const view = getKqWarehouseReserveView(getKqWarehouseSummary(removed), waterCondition);
    expect(view.stations).toEqual([
      { code: "SIM-HYGIENE-03", name: "Sas d’entretien", quantity: 1, wearGroups: [{ quantity: 1, wearPercent: null }] },
      { code: "SIM-WATER-03", name: "Centrale d’irrigation", quantity: 1, wearGroups: [{ quantity: 1, wearPercent: 20 }] },
    ]);
    expect(view.modules.map(({ code, quantity }) => ({ code, quantity }))).toEqual([{ code: "SIM-WATER-01", quantity: 2 }]);
    const historical = getKqWarehouseReserveView(getKqWarehouseSummary({ ...starter,
      optionInventory: [{ code: "SIM-WATER-03", quantity: 4 }, { code: "SIM-HYGIENE-03", quantity: 3 }],
    }));
    expect(historical.stations).toEqual([]);
    expect(historical.modules.map(({ code, quantity }) => ({ code, quantity }))).toEqual([
      { code: "SIM-WATER-03", quantity: 4 }, { code: "SIM-HYGIENE-03", quantity: 3 },
    ]);
  });
});
