import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => ({ rpc: mocks.rpc }) }));
import { getKqStorageRecords, getKqStorageSnapshot, handleKqStorageAction } from "./kanab-quest-storage-backend";
import { createKqStorageLot } from "@/lib/kanab-quest-storage";
const user = "00000000-0000-4000-8000-000000000001", flower = "00000000-0000-4000-8000-000000000002", key = "00000000-0000-4000-8000-000000000003";
const now = "2026-10-10T12:00:00.000Z";
const stored = () => ({ serverNow: now, cashCents: 20000, ownedMethodCodes: ["STORAGE-GLASS"], defaultMethodCode: "STORAGE-GLASS",
  ownedContainers: { "GLASS-1L": 2 }, capacity: { totalUnits: 1000, usedUnits: 1000, freeUnits: 0, reservedUnits: 1000, overflowUnits: 200 }, overflowSales: [], lots: [{
  flowerId: flower, varietyName: "Test", harvestGrams: 120, flowerStatus: "burned", revision: 1, juryScore: 8,
  state: createKqStorageLot({ flowerId: flower, harvestedAt: now, baseline: { varietyCode: "KQ-VAR-001", juryScore: 6, aroma: 80,
    care: { terpenes: 80, cannabinoidExpression: 80, cannabinoidConversion: 5, cannabinoidOxidation: 0 } },
    capacity: { totalUnits: 1200, allocations: [{ containerCode: "GLASS-1L", quantity: 2, storedUnits: 1000 }], overflowDeadlineAt: "2026-10-10T13:00:00Z" } }),
}] });
describe("server storage API", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: stored(), error: null }); });
  it("projects at server time, uses actual verdict score and hides persistence details", async () => {
    const result = await getKqStorageSnapshot(user);
    expect(result.lots[0].projection).toMatchObject({ conditionScore: 8, stage: "curing", serverNow: now });
    expect(result.lots[0]).not.toHaveProperty("state");
    expect(result.lots[0]).not.toHaveProperty("revision");
    expect(result.catalog).toHaveLength(5);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_warehouse_storage_state", { p_user_id: user });
  });
  it("keeps market history on its existing RPC", async () => {
    await getKqStorageRecords(user);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_storage_state", { p_user_id: user });
  });
  it("passes through explicit stock pools and leaves absent metadata unknown", async () => {
    const stockBreakdown = { bulkUnits: 0, bulkProtectedUnits: 0, bulkOverflowUnits: 0,
      packedUnits: 7350, packedActiveUnits: 5000, packedPausedUnits: 2350, packedOtherUnits: 0, packedPackets: 147 };
    mocks.rpc.mockResolvedValue({ data: { ...stored(), lots: [], stockBreakdown }, error: null });
    expect((await getKqStorageSnapshot(user)).stockBreakdown).toEqual(stockBreakdown);
    mocks.rpc.mockResolvedValue({ data: { ...stored(), lots: [], capacity: { ...stored().capacity, usedUnits: 7350 } }, error: null });
    expect((await getKqStorageSnapshot(user)).stockBreakdown).toBeUndefined();
  });
  it("never sends client prices, dates, exposures or owner to the transaction", async () => {
    await handleKqStorageAction(user, { action: "buy", containerCode: "GROVE-1LB", quantity: 3, requestKey: key, userId: "forged", priceCents: 0, state: {}, readyAt: "past" });
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_kq_storage_capacity_command", {
      p_user_id: user, p_action: "buy", p_method_code: null, p_container_code: "GROVE-1LB", p_quantity: 3, p_flower_id: null, p_request_key: key,
    });
  });
  it("passes only the selected lot identity for a reassignment", async () => {
    await handleKqStorageAction(user, { action: "assign", methodCode: "STORAGE-GLASS", flowerId: flower, requestKey: key });
    expect(mocks.rpc).toHaveBeenLastCalledWith("rpc_kq_storage_capacity_command", expect.objectContaining({ p_flower_id: flower, p_user_id: user }));
  });
  it("places the exact model using the authenticated owner and server-computed quantity", async () => {
    await handleKqStorageAction(user, { action: "place", containerCode: "GLASS-2L", flowerId: flower, requestKey: key, userId: "forged", totalUnits: 1 });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_storage_capacity_command", {
      p_user_id: user, p_action: "place", p_method_code: null, p_container_code: "GLASS-2L", p_quantity: null, p_flower_id: flower, p_request_key: key,
    });
  });
  it.each([
    { containerCode: "FORGED" }, { flowerId: undefined }, { quantity: 1 }, { methodCode: "STORAGE-GLASS" },
  ])("rejects ambiguous or invalid exact placement %s", async invalid => {
    await expect(handleKqStorageAction(user, { action: "place", containerCode: "GLASS-2L", flowerId: flower, requestKey: key, ...invalid })).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([
    ["storage_container_not_installed", "pas installé"], ["storage_container_capacity", "Pas assez"],
    ["warehouse_service_capacity_in_use", "cultures en cours"],
  ])("exposes actionable placement failures for %s", async (code, message) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: code } });
    await expect(handleKqStorageAction(user, { action: "place", containerCode: "GLASS-2L", flowerId: flower, requestKey: key })).rejects.toThrow(message);
  });
  it("sells only the server-computed surplus, never a client quantity or payout", async () => {
    await handleKqStorageAction(user, { action: "sell-overflow", flowerId: flower, requestKey: key, units: 99999, payoutCents: 99999 });
    expect(mocks.rpc).toHaveBeenLastCalledWith("rpc_kq_storage_capacity_command", {
      p_user_id: user, p_action: "sell-overflow", p_method_code: null, p_container_code: null, p_quantity: null, p_flower_id: flower, p_request_key: key,
    });
  });
  it.each([0, -1, 0.5, 1001, NaN, Infinity, "2"])("rejects invalid purchase quantities (%s)", async quantity => {
    await expect(handleKqStorageAction(user, { action: "buy", containerCode: "GLASS-1L", quantity, requestKey: key })).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects invalid actions, identifiers and installations before the database", async () => {
    for (const body of [
      { action: "invented", methodCode: "STORAGE-GLASS", requestKey: key },
      { action: "buy", methodCode: "FORGED", requestKey: key },
      { action: "assign", methodCode: "STORAGE-GLASS", requestKey: key },
      { action: "buy", methodCode: "STORAGE-GLASS", flowerId: flower, requestKey: key },
      { action: "buy", methodCode: "STORAGE-GLASS", requestKey: "invalid" },
      { action: "buy", containerCode: "GLASS-1L", quantity: 1, methodCode: "STORAGE-GLASS", requestKey: key },
      { action: "sell-overflow", flowerId: flower, quantity: 100, requestKey: key },
    ]) await expect(handleKqStorageAction(user, body)).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("excludes sold lots from the warehouse but retains their internal history", async () => {
    const result = stored();
    mocks.rpc.mockResolvedValue({ data: { ...result, lots: [{ ...result.lots[0], marketStatus: "sold" }] }, error: null });
    expect((await getKqStorageSnapshot(user)).lots).toEqual([]);
  });
  it("fails closed on invalid stored data", async () => {
    const result = stored();
    mocks.rpc.mockResolvedValue({ data: { ...result, lots: [{ ...result.lots[0], state: {} }] }, error: null });
    await expect(getKqStorageSnapshot(user)).rejects.toThrow("invalid_storage_state");
  });
  it("uses the SQL-synchronized warehouse jars once and preserves all legacy capacity", async () => {
    const result = stored();
    result.ownedContainers = { "GLASS-1L": 8 }; // 2 legacy + 1 pack of 6.
    result.capacity = { totalUnits: 4000, usedUnits: 2500, reservedUnits: 2500, freeUnits: 1500, overflowUnits: 0 };
    result.lots[0].harvestGrams = 250;
    result.lots[0].state.capacity = { totalUnits: 2500, allocations: [{ containerCode: "GLASS-1L", quantity: 5, storedUnits: 2500 }], overflowDeadlineAt: null, automaticOverflowSale: false };
    mocks.rpc.mockResolvedValue({ data: result, error: null });
    const snapshot = await getKqStorageSnapshot(user);
    expect(snapshot.capacity).toEqual(result.capacity);
    expect(snapshot.lots[0].projection.capacity).toMatchObject({ protectedUnits: 2500, overflowUnits: 0, overflowDue: false });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("retains warehouse overflow as stock without a fictional automatic sale deadline", async () => {
    const result = stored();
    result.lots[0].state.capacity = { totalUnits: 1200, allocations: [{ containerCode: "GLASS-1L", quantity: 2, storedUnits: 1000 }], overflowDeadlineAt: null, automaticOverflowSale: false };
    mocks.rpc.mockResolvedValue({ data: result, error: null });
    const snapshot = await getKqStorageSnapshot(user);
    expect(snapshot.lots[0].projection.capacity).toMatchObject({ totalUnits: 1200, protectedUnits: 1000, overflowUnits: 200, overflowDue: false, overflowDeadlineAt: null });
  });
  it("keeps installed capacities distinct from devices in reserve", async () => {
    const current = stored();
    mocks.rpc.mockResolvedValue({ data: { ...current, ownedContainers: { "GLASS-1L": 26, "CURTEC-60L": 4 }, installedContainers: { "GLASS-1L": 24, "CURTEC-60L": 0 },
      capacity: { ...current.capacity, totalUnits: 12000 } }, error: null });
    expect(await getKqStorageSnapshot(user)).toMatchObject({ installedContainers: { "GLASS-1L": 24, "CURTEC-60L": 0 }, capacity: { totalUnits: 12000 } });
  });
  it("directs stale storage purchases back to the floor plan", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "warehouse_storage_purchase" } });
    await expect(handleKqStorageAction(user, { action: "buy", containerCode: "CURTEC-60L", quantity: 1, requestKey: key })).rejects.toThrow("plan de l’entrepôt");
  });
});
