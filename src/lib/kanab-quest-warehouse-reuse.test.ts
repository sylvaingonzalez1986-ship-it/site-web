import { describe, expect, it } from "vitest";
import { createKqWarehouseStarter, getKqWarehouseQuote, type KqWarehouseState } from "./kanab-quest-warehouse";
import { initializeKqWarehouseCondition, type KqWarehouseCondition } from "./kanab-quest-warehouse-condition";
import { getKqWarehouseReusePreview } from "./kanab-quest-warehouse-reuse";

const code = "SIM-LIGHT-02";
function fixture(reserveQuantity = 2) {
  const starter = createKqWarehouseStarter();
  const previous = getKqWarehouseQuote({ ...starter,
    zones: [{ ...starter.zones[0], width: 4 }],
    equipment: [...starter.equipment, { code, quantity: reserveQuantity }].filter(item => item.quantity > 0),
  }).nextState;
  const condition = initializeKqWarehouseCondition(previous);
  condition.assets = condition.assets.flatMap(asset => asset.code === code ? Array.from({ length: asset.quantity }, (_, index) => ({
    ...asset, id: `${asset.id}-${index}`, quantity: 1, wearPercent: index ? 80 : 20,
  })) : [asset]);
  const candidate = { ...previous, zones: previous.zones.map(zone => ({ ...zone, lightingCode: code })) };
  return { previous, candidate, condition, zoneId: previous.zones[0].id };
}

describe("warehouse reuse preview", () => {
  it("shows mixed worn reserve as reuse with no new expense and does not mutate inventory", () => {
    const { previous, candidate, condition, zoneId } = fixture();
    const before = JSON.stringify({ previous, candidate, condition });
    const result = getKqWarehouseReusePreview(previous, candidate, zoneId, "device", code, condition);
    expect(result).toMatchObject({ keptQuantity: 0, reusedQuantity: 2, newQuantity: 0, newCostCents: 0,
      groups: [{ origin: "reused", quantity: 1, wearPercent: 20 }, { origin: "reused", quantity: 1, wearPercent: 80 }] });
    expect(JSON.stringify({ previous, candidate, condition })).toBe(before);
  });

  it("purchases only the missing device while preserving worn reuse", () => {
    const { previous, candidate, condition, zoneId } = fixture(1);
    expect(getKqWarehouseReusePreview(previous, candidate, zoneId, "device", code, condition)).toMatchObject({
      keptQuantity: 0, reusedQuantity: 1, newQuantity: 1, newCostCents: 32900, planPurchaseCents: 32900,
      groups: [{ origin: "reused", quantity: 1, wearPercent: 20 }, { origin: "new", quantity: 1, wearPercent: 0 }],
    });
  });

  it("keeps unknown wear unknown even though stock quantities can be allocated", () => {
    const { previous, candidate, zoneId } = fixture(1);
    const result = getKqWarehouseReusePreview(previous, candidate, zoneId, "device", code);
    expect(result).toMatchObject({ reusedQuantity: 1, newQuantity: 1, newCostCents: 32900,
      groups: [{ origin: "reused", quantity: 1, wearPercent: null }, { origin: "new", quantity: 1, wearPercent: 0 }] });
    expect(result?.condition).toBeUndefined();
  });

  it("distinguishes retained devices from reuse and attributes purchases elsewhere to the whole plan", () => {
    const { previous: base } = fixture(1);
    const previous = getKqWarehouseQuote({ ...base, zones: [
      { ...base.zones[0], width: 2, lightingCode: code },
      { ...base.zones[0], id: "second", x: 5, width: 4 },
    ], equipment: base.equipment.map(item => item.code === code ? { ...item, quantity: 2 } : item) }).nextState;
    const condition = initializeKqWarehouseCondition(previous);
    condition.assets = condition.assets.map(asset => ({ ...asset, wearPercent: asset.zoneId ? 60 : 20 }));
    const candidate = { ...previous, zones: previous.zones.map(zone => ({ ...zone, lightingCode: code })) };
    const first = getKqWarehouseReusePreview(previous, candidate, previous.zones[0].id, "device", code, condition);
    expect(first).toMatchObject({ keptQuantity: 1, reusedQuantity: 0, newQuantity: 0, newCostCents: 0,
      planPurchaseQuantity: 1, planPurchaseCents: 32900, groups: [{ origin: "kept", quantity: 1, wearPercent: 60 }] });
    const second = getKqWarehouseReusePreview(previous, candidate, "second", "device", code, condition);
    expect(second).toMatchObject({ keptQuantity: 0, reusedQuantity: 1, newQuantity: 1 });
  });

  it("identifies material released by another draft zone as reuse", () => {
    const { previous: base } = fixture(1);
    const previous = getKqWarehouseQuote({ ...base, zones: [
      base.zones[0], { ...base.zones[0], id: "second", x: 5, width: 2, lightingCode: code },
    ] }).nextState;
    const condition = initializeKqWarehouseCondition(previous);
    condition.assets = condition.assets.map(asset => ({ ...asset, wearPercent: asset.zoneId === "second" ? 75 : 0 }));
    const candidate = { ...previous, zones: [{ ...previous.zones[0], width: 2, lightingCode: code }] };
    expect(getKqWarehouseReusePreview(previous, candidate, previous.zones[0].id, "device", code, condition)).toMatchObject({
      keptQuantity: 0, reusedQuantity: 1, newQuantity: 0, groups: [{ origin: "reused", quantity: 1, wearPercent: 75 }],
    });
  });

  it("preserves per-square-metre module wear when a reserve group is split", () => {
    const { previous: base } = fixture(0);
    const previous: KqWarehouseState = { ...base, optionInventory: [{ code: "SIM-WATER-01", quantity: 6 }] };
    const initial = initializeKqWarehouseCondition(previous);
    const condition: KqWarehouseCondition = { version: 1, assets: initial.assets.flatMap(asset => asset.kind === "option" ? [
      { ...asset, quantity: 2, wearPercent: 20 }, { ...asset, id: `${asset.id}-worn`, quantity: 4, wearPercent: 80 },
    ] : [asset]) };
    const candidate = { ...previous, zones: previous.zones.map(zone => ({ ...zone, optionCodes: ["SIM-WATER-01"] })) };
    expect(getKqWarehouseReusePreview(previous, candidate, previous.zones[0].id, "option", "SIM-WATER-01", condition)).toMatchObject({
      reusedQuantity: 4, newQuantity: 0, newCostCents: 0,
      groups: [{ origin: "reused", quantity: 2, wearPercent: 20 }, { origin: "reused", quantity: 2, wearPercent: 80 }],
    });
  });

  it("does not display a zero-price preview for invalid or stale allocation", () => {
    const { previous, candidate, zoneId } = fixture();
    expect(getKqWarehouseReusePreview(previous, candidate, zoneId, "device", code, { version: 1, assets: [] })).toBeNull();
    expect(getKqWarehouseReusePreview(previous, { ...candidate, zones: candidate.zones.map(zone => ({ ...zone, width: 100 })) }, zoneId, "device", code)).toBeNull();
    expect(getKqWarehouseReusePreview(previous, candidate, "absent", "device", code)).toBeNull();
  });
});
