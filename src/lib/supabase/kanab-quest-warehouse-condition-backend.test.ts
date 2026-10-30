import { beforeEach, describe, expect, it, vi } from "vitest";
const { client } = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("./admin", () => ({ createSupabaseServiceClient: client }));
vi.mock("./kanab-quest-warehouse-flow-backend", () => ({ getKqWarehouseSalesForecast: vi.fn().mockResolvedValue(null) }));
import { createKqWarehouseStarter, getKqWarehouseQuote } from "../kanab-quest-warehouse";
import { initializeKqWarehouseCondition } from "../kanab-quest-warehouse-condition";
import { getKqWarehouseRunSnapshot, getKqWarehouseSnapshot, quoteKqWarehouseZoneRemoval, removeKqWarehouseCultureZone, saveKqWarehouseLayout } from "./kanab-quest-warehouse-backend";

const userId = "11111111-1111-4111-8111-111111111111", requestKey = "22222222-2222-4222-8222-222222222222";
const state = createKqWarehouseStarter(), zoneId = state.zones[0].id;
const condition = initializeKqWarehouseCondition(state);
const current = () => ({ state, revision: 3, cashCents: 1000000, migrationCreditCents: 0,
  activeRun: false, activeRuns: [] as Array<{ zoneId: string }>, legacyActiveRun: false,
  stockGrams: 0, storageCapacityGrams: 400, salesGramsPerDay: null, context: { available: true, salesAvailable: false },
  cultureEquipment: { ...condition, assets: condition.assets.map(asset => ({ ...asset, purchaseUnitCents: 10000, wearPercent: 50 })) },
});
const input = { userId, zoneId, expectedRevision: 3 };

describe("authoritative warehouse condition boundary", () => {
  beforeEach(() => vi.clearAllMocks());
  it("quotes only server-owned equipment and does not write or credit the wallet", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: current(), error: null }); client.mockReturnValue({ rpc });
    const quote = await quoteKqWarehouseZoneRemoval(input);
    expect(quote.resaleCents).toBe(current().cultureEquipment.assets.reduce((sum, asset) => sum + asset.quantity * 5000, 0));
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["rpc_kq_warehouse_snapshot"]);
  });
  it.each(["busy", "revision", "unknown-zone"])("rejects %s before a sale transaction", async mode => {
    const snapshot = current();
    if (mode === "busy") { snapshot.activeRun = true; snapshot.activeRuns = [{ zoneId }]; }
    if (mode === "revision") snapshot.revision++;
    const rpc = vi.fn().mockResolvedValue({ data: snapshot, error: null }); client.mockReturnValue({ rpc });
    await expect(quoteKqWarehouseZoneRemoval({ ...input, zoneId: mode === "unknown-zone" ? "absent" : zoneId })).rejects.toMatchObject({ status: 409 });
    expect(rpc.mock.calls.some(([name]) => name === "rpc_kq_warehouse_remove_zone")).toBe(false);
  });
  it("checks the exact confirmed amount and sends a compare-and-swap state to the transaction", async () => {
    const rpc = vi.fn().mockImplementation((name: string, args: Record<string, unknown>) => Promise.resolve({ error: null,
      data: name === "rpc_kq_warehouse_receipt" ? null : name === "rpc_kq_warehouse_remove_zone" ? { ...current(), state: args.p_next_state, cultureEquipment: { version: 1, assets: args.p_next_assets }, revision: 4,
        receipt: { requestKey, replayed: false, resaleCents: args.p_resale_cents, soldCount: 2, keptCount: 0 } } : current() }));
    client.mockReturnValue({ rpc });
    await expect(removeKqWarehouseCultureZone({ ...input, requestKey, resellEquipment: true, expectedResaleCents: 1 })).rejects.toMatchObject({ status: 409 });
    const quote = await quoteKqWarehouseZoneRemoval(input);
    const result = await removeKqWarehouseCultureZone({ ...input, requestKey, resellEquipment: true, expectedResaleCents: quote.resaleCents });
    expect(result.removalReceipt).toMatchObject({ resaleCents: quote.resaleCents, soldCount: 2 });
    const args = rpc.mock.calls.find(([name]) => name === "rpc_kq_warehouse_remove_zone")![1];
    expect(args.p_previous_assets).toEqual(current().cultureEquipment.assets);
    expect(args.p_previous_state).toEqual(state);
    expect(args.p_next_state.preparedAreaM2).toBe(state.preparedAreaM2);
    expect(args.p_next_state.zones).toEqual([]);
    expect(args.p_next_assets).toEqual([]);
  });
  it("returns an old receipt before checking a zone which has already been removed", async () => {
    const receipt = { requestKey, resaleCents: 10000, soldCount: 2, keptCount: 0, replayed: true };
    const rpc = vi.fn().mockResolvedValue({ error: null, data: { ...current(), state: { ...state, zones: [] }, receipt } }); client.mockReturnValue({ rpc });
    expect(await removeKqWarehouseCultureZone({ ...input, requestKey, resellEquipment: true, expectedResaleCents: 10000 })).toMatchObject({ removalReceipt: receipt });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["rpc_kq_warehouse_receipt"]);
  });
  it("initializes unknown acquisition history once without pretending it was paid", async () => {
    const rpc = vi.fn().mockImplementation((name: string, args: Record<string, unknown>) => Promise.resolve({ error: null, data: name === "rpc_kq_warehouse_condition_initialize"
      ? { ...current(), cultureEquipment: { version: 1, assets: args.p_assets } } : { ...current(), cultureEquipment: null } }));
    client.mockReturnValue({ rpc });
    const snapshot = await getKqWarehouseSnapshot(userId);
    expect(snapshot.cultureEquipment?.assets.every(asset => asset.purchaseUnitCents === null)).toBe(true);
    expect(rpc.mock.calls.filter(([name]) => name === "rpc_kq_warehouse_condition_initialize")).toHaveLength(1);
  });
  it("recovers the winning receipt when a duplicate request commits during the snapshot read", async () => {
    const receipt = { requestKey, resaleCents: 10000, soldCount: 2, keptCount: 0, replayed: true };
    let receiptReads = 0;
    const rpc = vi.fn().mockImplementation((name: string) => Promise.resolve({ error: null, data: name === "rpc_kq_warehouse_receipt"
      ? ++receiptReads === 1 ? null : { ...current(), state: { ...state, zones: [] }, revision: 4, receipt }
      : { ...current(), state: { ...state, zones: [] }, revision: 4 } }));
    client.mockReturnValue({ rpc });
    expect(await removeKqWarehouseCultureZone({ ...input, requestKey, resellEquipment: true, expectedResaleCents: 10000 })).toMatchObject({ removalReceipt: receipt });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["rpc_kq_warehouse_receipt", "rpc_kq_warehouse_snapshot", "rpc_kq_warehouse_receipt"]);
  });
  it("captures wear in the new run without modifying the installation", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: current(), error: null }); client.mockReturnValue({ rpc });
    const run = await getKqWarehouseRunSnapshot(userId, zoneId);
    expect(run).toMatchObject({ wearVersion: 1, yieldFactor: .75, cultureEquipment: current().cultureEquipment });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["rpc_kq_warehouse_snapshot"]);
  });
  it("uses tracked save, preserves old wear and excludes conversion credit from resale basis", async () => {
    const snapshot = current();
    const candidate = { ...state, zones: [...state.zones, { ...state.zones[0], id: "new-zone", x: 6, y: 6 }] };
    const quote = getKqWarehouseQuote(candidate, state);
    snapshot.migrationCreditCents = quote.totalCostCents;
    const rpc = vi.fn().mockImplementation((name: string) => Promise.resolve({ data: name === "rpc_kq_warehouse_receipt" ? null : snapshot, error: null })); client.mockReturnValue({ rpc });
    await saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 3, state: candidate, expectedCostCents: quote.totalCostCents });
    const args = rpc.mock.calls.find(([name]) => name === "rpc_kq_warehouse_save_condition")![1];
    expect(args.p_next_assets.filter((asset: { zoneId: string }) => asset.zoneId === zoneId)).toEqual(snapshot.cultureEquipment.assets);
    expect(args.p_next_assets.filter((asset: { zoneId: string }) => asset.zoneId === "new-zone").every((asset: { purchaseUnitCents: number }) => asset.purchaseUnitCents === 0)).toBe(true);
    expect(rpc.mock.calls.some(([name]) => name === "rpc_kq_warehouse_save")).toBe(false);
  });
});
