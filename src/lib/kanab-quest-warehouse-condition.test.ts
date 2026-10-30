import { describe, expect, it } from "vitest";
import { createKqWarehouseStarter, getKqWarehouseQuote, getKqWarehouseRunSnapshot, isKqWarehouseRunSnapshot } from "./kanab-quest-warehouse";
import { assertKqWarehouseCondition, getKqWarehouseAssetResaleCents, getKqWarehouseRemovalQuote, getKqWarehouseZoneCondition,
  initializeKqWarehouseCondition, reconcileKqWarehouseCondition, removeKqWarehouseZone, type KqWarehouseAsset } from "./kanab-quest-warehouse-condition";
import { getKqCampaignParticipants, getKqCampaignWarehouse, isKqCampaign } from "./kanab-quest-campaign";
import { KQ_BUDDIES } from "./kanab-quest-game";
import { KQ_WAREHOUSE_CATALOG } from "./kanab-quest-warehouse-catalog";

const starter = createKqWarehouseStarter();
const zoneId = starter.zones[0].id;
const paid = (wear = 50) => ({ ...initializeKqWarehouseCondition(starter), assets: initializeKqWarehouseCondition(starter).assets.map(asset => ({ ...asset, purchaseUnitCents: 10000, wearPercent: wear })) });

describe("warehouse equipment condition and resale", () => {
  it.each([[0, 10000], [20, 8000], [50, 5000], [80, 2000], [100, 0]])("values %s%% wear at %s cents per funded unit", (wearPercent, expected) => {
    expect(getKqWarehouseAssetResaleCents({ purchaseUnitCents: 10000, quantity: 1, wearPercent } as KqWarehouseAsset)).toBe(expected);
  });
  it("distinguishes free equipment from an unknown acquisition", () => {
    const free = initializeKqWarehouseCondition(starter, true), historic = initializeKqWarehouseCondition(starter);
    expect(getKqWarehouseRemovalQuote(starter, free, zoneId, 1)).toMatchObject({ resaleCents: 0, unknownPurchaseCount: 0 });
    const quote = getKqWarehouseRemovalQuote(starter, historic, zoneId, 1);
    expect(quote.unknownPurchaseCount).toBeGreaterThan(0);
    expect(quote.lines.every(line => line.purchaseCents === null && line.resaleCents === null)).toBe(true);
    const removed = removeKqWarehouseZone(starter, historic, zoneId, true);
    expect(removed.state.equipment).toEqual(starter.equipment);
    expect(removed.condition.assets.every(asset => asset.zoneId === null)).toBe(true);
  });
  it("keeps wear and funded cost when a zone is removed and recreated from reserve", () => {
    const condition = paid(80), removed = removeKqWarehouseZone(starter, condition, zoneId, false);
    const next = getKqWarehouseQuote({ ...removed.state, zones: [{ ...starter.zones[0], id: "new-zone" }] }, removed.state);
    expect(next.totalCostCents).toBe(0);
    const reused = reconcileKqWarehouseCondition(removed.state, next.nextState, removed.condition, { requestKey: "reuse", fundedFraction: 1 });
    expect(reused.assets.map(asset => [asset.id, asset.wearPercent, asset.purchaseUnitCents])).toEqual(condition.assets.map(asset => [asset.id, 80, 10000]));
    expect(getKqWarehouseZoneCondition("new-zone", reused.assets)).toEqual({ wearPercent: 80, yieldPercent: 60 });
  });
  it("sells only assigned known equipment and preserves room preparation and service capacity", () => {
    const condition = paid(50), quote = getKqWarehouseRemovalQuote(starter, condition, zoneId, 3);
    const next = removeKqWarehouseZone(starter, condition, zoneId, true);
    expect(quote.resaleCents).toBe(condition.assets.reduce((sum, asset) => sum + asset.quantity * 5000, 0));
    expect(next.condition.assets).toHaveLength(0);
    expect(next.state.preparedAreaM2).toBe(starter.preparedAreaM2);
    expect(next.state.serviceZones).toEqual(starter.serviceZones);
    expect(next.state.equipment).toEqual(starter.equipment.filter(item => !condition.assets.some(asset => asset.code === item.code)));
  });
  it("keeps the first zone's equipment while funding new units for another", () => {
    const condition = paid(60);
    const candidate = { ...starter, zones: [...starter.zones, { ...starter.zones[0], id: "second", x: 6, y: 6 }] };
    const quote = getKqWarehouseQuote(candidate, starter);
    const next = reconcileKqWarehouseCondition(starter, quote.nextState, condition, { requestKey: "purchase", fundedFraction: .5 });
    expect(next.assets.filter(asset => asset.zoneId === zoneId)).toEqual(condition.assets);
    expect(next.assets.filter(asset => asset.zoneId === "second").every(asset => asset.wearPercent === 0 && asset.sourceAssetKey === "warehouse:purchase")).toBe(true);
    expect(next.assets.filter(asset => asset.zoneId === "second").reduce((sum, asset) => sum + asset.purchaseUnitCents! * asset.quantity, 0)).toBeLessThanOrEqual(quote.equipmentCostCents * .5);
    const removed = removeKqWarehouseZone(quote.nextState, next, zoneId, true);
    expect(removed.condition.assets.filter(asset => asset.zoneId === "second")).toEqual(next.assets.filter(asset => asset.zoneId === "second"));
  });
  it("rejects missing, duplicated and misassigned inventory", () => {
    const condition = paid();
    expect(() => assertKqWarehouseCondition(starter, { version: 1, assets: [] })).toThrow();
    expect(() => assertKqWarehouseCondition(starter, { ...condition, assets: [...condition.assets, condition.assets[0]] })).toThrow();
    expect(() => assertKqWarehouseCondition(starter, { ...condition, assets: condition.assets.map(asset => ({ ...asset, zoneId: "absent" })) })).toThrow();
    expect(getKqWarehouseZoneCondition("absent", condition.assets)).toEqual({ wearPercent: null, yieldPercent: null });
  });
  it("uses exact funded cents even when the floating-point ratio rounds below a cent", () => {
    const condition = initializeKqWarehouseCondition(starter);
    const nextState = { ...starter, equipment: starter.equipment.map(item => item.code === "MH-TS1000" ? { ...item, quantity: item.quantity + 1 } : item) };
    const purchase = { requestKey: "credit", fundedFraction: 157 / 298, fundedCents: 157, investmentCents: 298 };
    expect(Math.floor(KQ_WAREHOUSE_CATALOG.find(item => item.code === "MH-TS1000")!.priceCents * purchase.fundedFraction)).toBe(7849);
    const next = reconcileKqWarehouseCondition(starter, nextState, condition, purchase);
    expect(next.assets.find(asset => asset.sourceAssetKey === "warehouse:credit")?.purchaseUnitCents).toBe(7850);
    expect(() => reconcileKqWarehouseCondition(starter, nextState, condition, { ...purchase, fundedCents: 299 })).toThrow();
  });
  it("freezes the reduced yield at launch and validates it without changing historical runs", () => {
    const historical = getKqWarehouseRunSnapshot(starter, 1, zoneId);
    const worn = getKqWarehouseRunSnapshot(starter, 1, zoneId, 2, 2, 2, paid(50));
    expect(worn.estimatedHarvestGrams).toBe(historical.estimatedHarvestGrams * .75);
    expect(worn.yieldFactor).toBe(.75);
    expect(isKqWarehouseRunSnapshot(worn)).toBe(true);
    expect(isKqWarehouseRunSnapshot(historical)).toBe(true);
    expect(isKqWarehouseRunSnapshot({ ...worn, estimatedHarvestGrams: historical.estimatedHarvestGrams })).toBe(false);
    expect(isKqWarehouseRunSnapshot({ ...worn, yieldFactor: 1 })).toBe(false);
    expect(historical.wearVersion).toBeUndefined();
  });
  it("preserves condition in campaign previews and rejects a mismatched manifest", () => {
    const plan = { ...starter, zones: starter.zones.map(zone => ({ ...zone, buddieCode: KQ_BUDDIES[0].code })) };
    const condition = paid(80);
    const participants = getKqCampaignParticipants(plan, 1, condition);
    expect(getKqCampaignWarehouse(participants)?.estimatedHarvestGrams).toBe(participants[0].warehouse.estimatedHarvestGrams);
    const runId = "11000000-0000-4000-8000-000000000001";
    const campaign = { version: 1, id: runId, leaderRunId: runId, members: participants.map(member => ({ ...member, runId })) };
    expect(isKqCampaign(campaign)).toBe(true);
    expect(isKqCampaign({ ...campaign, members: campaign.members.map(member => ({ ...member, warehouse: { ...member.warehouse, yieldFactor: 1 } })) })).toBe(false);
  });
});
