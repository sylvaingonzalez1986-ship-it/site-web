import { beforeEach, describe, expect, it, vi } from "vitest";
const { createSupabaseServiceClient } = vi.hoisted(() => ({ createSupabaseServiceClient: vi.fn() }));
vi.mock("./admin", () => ({ createSupabaseServiceClient }));
vi.mock("./kanab-quest-warehouse-flow-backend", () => ({ getKqWarehouseSalesForecast: vi.fn().mockResolvedValue(null) }));
import { compactKqWarehouseToStarterFloor, createKqWarehouseStarter, getKqWarehouseQuote, type KqWarehouseState } from "../kanab-quest-warehouse";
import { getKqWarehouseProcessingEquipment, getKqWarehouseRunSnapshot, getKqWarehouseSnapshot, saveKqWarehouseLayout } from "./kanab-quest-warehouse-backend";
import { getKqWarehouseSalesForecast } from "./kanab-quest-warehouse-flow-backend";

const userId = "11111111-1111-4111-8111-111111111111";
const requestKey = "22222222-2222-4222-8222-222222222222";
const starter = createKqWarehouseStarter();
const legacyFloor = () => {
  const state = createKqWarehouseStarter(); delete state.floor;
  state.serviceZones = state.serviceZones!.map(zone => ({ ...zone, y: 24 }));
  return state;
};
const current = () => ({ state: starter, revision: 1, cashCents: 100_000, activeRun: false, legacyActiveRun: false,
  migrationCreditCents: 0, stockGrams: 0, storageCapacityGrams: 400, salesGramsPerDay: null, context: { available: true, salesAvailable: false } });

describe("warehouse service boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("compacts an idle historical plan once and returns the committed revision before a new run", async () => {
    let saved = { ...current(), state: legacyFloor(), revision: 7 };
    const rpc = vi.fn().mockImplementation(async (name: string, args: { p_next_state?: KqWarehouseState }) => {
      if (name === "rpc_kq_warehouse_compact") saved = { ...saved, state: args.p_next_state!, revision: 8 };
      return { error: null, data: saved };
    });
    createSupabaseServiceClient.mockReturnValue({ rpc });
    const run = await getKqWarehouseRunSnapshot(userId, "starter");
    expect(run).toMatchObject({ revision: 8, zoneId: "starter", sourceState: { floor: { columns: 10, rows: 10 } } });
    expect(rpc.mock.calls.find(([name]) => name === "rpc_kq_warehouse_compact")![1]).toMatchObject({ p_expected_revision: 7 });
    expect(await getKqWarehouseSnapshot(userId)).toMatchObject({ revision: 8, state: saved.state });
    expect(rpc.mock.calls.filter(([name]) => name === "rpc_kq_warehouse_compact")).toHaveLength(1);
  });

  it.each(["active", "large", "legacy-active"])("keeps a %s legacy plan untouched", async kind => {
    const state = legacyFloor(); if (kind === "large") state.preparedAreaM2 = 101;
    const rpc = vi.fn().mockResolvedValue({ error: null, data: { ...current(), state, activeRun: kind === "active", legacyActiveRun: kind === "legacy-active" } });
    createSupabaseServiceClient.mockReturnValue({ rpc });
    expect((await getKqWarehouseSnapshot(userId)).state).toEqual(state);
    expect(rpc.mock.calls.some(([name]) => name === "rpc_kq_warehouse_compact")).toBe(false);
  });

  it("keeps the concurrent winner returned by compaction rather than its stale proposed draft", async () => {
    const state = legacyFloor(), winner = { ...state, zones: state.zones.map(zone => ({ ...zone, name: "Modifiée ailleurs" })) };
    const rpc = vi.fn().mockImplementation(async (name: string) => ({ error: null,
      data: { ...current(), state: name === "rpc_kq_warehouse_compact" ? winner : state, revision: name === "rpc_kq_warehouse_compact" ? 9 : 8 } }));
    createSupabaseServiceClient.mockReturnValue({ rpc });
    expect(await getKqWarehouseRunSnapshot(userId)).toMatchObject({ revision: 9, sourceState: winner });
  });

  it("keeps a legacy screen available if only the new RPC is not deployed yet", async () => {
    const state = legacyFloor();
    const rpc = vi.fn().mockImplementation(async (name: string) => name === "rpc_kq_warehouse_compact"
      ? { data: null, error: { message: "Could not find the function public.rpc_kq_warehouse_compact in the schema cache" } }
      : { error: null, data: { ...current(), state } });
    createSupabaseServiceClient.mockReturnValue({ rpc });
    expect((await getKqWarehouseSnapshot(userId)).state).toEqual(state);
  });

  it("does not hide other failures from the compaction RPC", async () => {
    const rpc = vi.fn().mockImplementation(async (name: string) => name === "rpc_kq_warehouse_compact"
      ? { data: null, error: { message: "database unavailable" } }
      : { error: null, data: { ...current(), state: legacyFloor() } });
    createSupabaseServiceClient.mockReturnValue({ rpc });
    await expect(getKqWarehouseSnapshot(userId)).rejects.toThrow("database unavailable");
  });

  it("rejects removal of the funded floor before the spending RPC, but still replays old receipts", async () => {
    const state = { ...starter }; delete state.floor;
    const rpc = vi.fn().mockImplementation(async (name: string) => ({ error: null, data: name === "rpc_kq_warehouse_receipt" ? null : current() }));
    createSupabaseServiceClient.mockReturnValue({ rpc });
    await expect(saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, state, expectedCostCents: 0 })).rejects.toMatchObject({ status: 409 });
    expect(rpc.mock.calls.some(([name]) => name === "rpc_kq_warehouse_save")).toBe(false);
    rpc.mockResolvedValue({ error: null, data: { ...current(), state: compactKqWarehouseToStarterFloor(legacyFloor()),
      revision: 3, receipt: { requestKey, replayed: true } } });
    expect(await saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, state, expectedCostCents: 0 })).toMatchObject({ receipt: { replayed: true } });
  });

  it("recalculates purchases and preparation, strips invented discounts and protects existing equipment", async () => {
    const candidate = { ...starter, preparedAreaM2: 100, equipment: [], zones: starter.zones.map(zone => ({ ...zone, width: 2, free: true })) };
    const quote = getKqWarehouseQuote(candidate, starter);
    const rpc = vi.fn().mockImplementation((name: string) => Promise.resolve({ error: null,
      data: name === "rpc_kq_warehouse_receipt" ? null : name === "rpc_kq_warehouse_save" ? { ...current(), revision: 2, state: quote.nextState } : current() }));
    createSupabaseServiceClient.mockReturnValue({ rpc });
    await saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, state: candidate, expectedCostCents: quote.totalCostCents });
    const args = rpc.mock.calls.find(([name]) => name === "rpc_kq_warehouse_save")![1];
    expect(args.p_cost_cents).toBeGreaterThan(0);
    expect(args.p_next_state.preparedAreaM2).toBe(4);
    expect(args.p_next_state.serviceZones).toEqual(starter.serviceZones);
    expect(args.p_next_state.zones[0]).not.toHaveProperty("free");
    expect(args.p_next_state.equipment).toEqual(expect.arrayContaining(starter.equipment.filter(item => item.code !== "MH-TS1000")));
    expect(args.p_previous_state).toEqual(starter);
  });

  it("rejects an invented zero price before invoking the spending RPC", async () => {
    const rpc = vi.fn().mockImplementation((name: string) => Promise.resolve({ error: null, data: name === "rpc_kq_warehouse_receipt" ? null : current() }));
    createSupabaseServiceClient.mockReturnValue({ rpc });
    const candidate = { ...starter, zones: starter.zones.map(zone => ({ ...zone, width: 10 })) };
    await expect(saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, state: candidate, expectedCostCents: 0 })).rejects.toThrow("devis a changé");
    expect(rpc.mock.calls.some(([name]) => name === "rpc_kq_warehouse_save")).toBe(false);
  });

  it("recomputes fictional modules and strips client-defined effects before spending", async () => {
    const candidate = { ...starter, zones: starter.zones.map(zone => ({ ...zone, optionCodes: ["SIM-NUTRITION-03", "SIM-CLIMATE-02"], qualityBonus: 999 })),
      optionInventory: [{ code: "SIM-NUTRITION-03", quantity: 1, discountCents: 99999 }] };
    const quote = getKqWarehouseQuote(candidate, starter);
    const rpc = vi.fn().mockImplementation((name: string) => Promise.resolve({ error: null,
      data: name === "rpc_kq_warehouse_receipt" ? null : name === "rpc_kq_warehouse_save" ? { ...current(), revision: 2, state: quote.nextState } : current() }));
    createSupabaseServiceClient.mockReturnValue({ rpc });
    await saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, state: candidate, expectedCostCents: quote.totalCostCents });
    const args = rpc.mock.calls.find(([name]) => name === "rpc_kq_warehouse_save")![1];
    expect(args.p_cost_cents).toBe(4255);
    expect(args.p_next_state.optionInventory).toEqual([{ code: "SIM-CLIMATE-02", quantity: 1 }, { code: "SIM-NUTRITION-03", quantity: 1 }]);
    expect(args.p_next_state.zones[0].optionCodes).toEqual(["SIM-CLIMATE-02", "SIM-NUTRITION-03"]);
    expect(args.p_next_state.zones[0]).not.toHaveProperty("qualityBonus");
    expect(args.p_request.state.optionInventory[0]).not.toHaveProperty("discountCents");
  });

  it("replays a completed request even if its original revision is now stale", async () => {
    const receipt = { requestKey, revision: 2, investmentCents: 0, creditUsedCents: 0, chargedCents: 0, replayed: true };
    const rpc = vi.fn().mockResolvedValue({ error: null, data: { ...current(), revision: 3, receipt } });
    createSupabaseServiceClient.mockReturnValue({ rpc });
    expect((await saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, state: starter, expectedCostCents: 0 })).receipt).toEqual(receipt);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("defers conversion while an old culture is running and does not debit anything", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null, data: { ...current(), state: null, revision: 0, activeRun: true, legacyActiveRun: true } });
    createSupabaseServiceClient.mockReturnValue({ rpc });
    expect(await getKqWarehouseSnapshot(userId)).toMatchObject({ state: starter, revision: 0, legacyActiveRun: true });
    expect(await getKqWarehouseRunSnapshot(userId)).toBeNull();
    expect(rpc.mock.calls.every(([name]) => name === "rpc_kq_warehouse_snapshot")).toBe(true);
  });

  it("refuses unknown equipment, overlaps and oversized quantities before database access", async () => {
    for (const state of [
      { ...starter, equipment: [{ code: "FREE-LIGHT", quantity: 1 }] },
      { ...starter, zones: [...starter.zones, { ...starter.zones[0], id: "duplicate" }] },
      { ...starter, equipment: [{ code: "MH-TS1000", quantity: 100_001 }] },
    ]) await expect(saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, expectedCostCents: 0, state })).rejects.toThrow("invalides");
    expect(createSupabaseServiceClient).not.toHaveBeenCalled();
  });

  it("initializes the physical warehouse before a new run even when its room was never opened", async () => {
    const rpc = vi.fn().mockImplementation((name: string) => Promise.resolve({ error: null,
      data: name === "rpc_kq_warehouse_initialize" ? current() : { ...current(), state: null, revision: 0 } }));
    createSupabaseServiceClient.mockReturnValue({ rpc });
    expect(await getKqWarehouseRunSnapshot(userId)).toMatchObject({ revision: 1, sourceState: starter, activeAreaM2: 1 });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["rpc_kq_warehouse_snapshot", "rpc_kq_warehouse_initialize"]);
  });

  it("converts before commerce settlement can sell legacy overflow automatically", async () => {
    const order: string[] = [];
    let converted = false;
    const rpc = vi.fn().mockImplementation((name: string) => {
      order.push(name);
      if (name === "rpc_kq_warehouse_initialize") converted = true;
      return Promise.resolve({ error: null, data: converted ? current() : { ...current(), state: null, revision: 0 } });
    });
    createSupabaseServiceClient.mockReturnValue({ rpc });
    vi.mocked(getKqWarehouseSalesForecast).mockImplementationOnce(async () => {
      order.push("commerce-forecast");
      throw new Error("forecast temporarily unavailable");
    });
    expect(await getKqWarehouseSnapshot(userId)).toMatchObject({ state: starter, revision: 1 });
    expect(order).toEqual(["rpc_kq_warehouse_snapshot", "rpc_kq_warehouse_initialize", "commerce-forecast", "rpc_kq_warehouse_snapshot"]);
  });

  it("uses the shared workshop levels and excludes machines requiring maintenance", async () => {
    createSupabaseServiceClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ error: null, data: current() }) });
    const shop = { sharedEquipment: { equippedCodes: ["PRESS-0600", "WASHER-25L"], operationalCodes: ["PRESS-0600"],
      levels: { "PRESS-0600": 4, "WASHER-25L": 2 } } };
    expect(await getKqWarehouseProcessingEquipment(userId, shop)).toMatchObject({
      equippedCodes: ["PRESS-0600", "TENT-080-STARTER", "WASHER-25L"], operationalCodes: ["PRESS-0600", "TENT-080-STARTER"],
      levels: { "PRESS-0600": 4, "WASHER-25L": 2, "TENT-080-STARTER": 1 },
      processingBatchGrams: { "PRESS-0600": 160, "WASHER-25L": 207 }, processingDurationSeconds: { "PRESS-0600": 3600, "WASHER-25L": 7200 },
      workshopSnapshot: { equippedCodes: ["PRESS-0600", "TENT-080-STARTER", "WASHER-25L"], levels: { "PRESS-0600": 4, "WASHER-25L": 2, "TENT-080-STARTER": 1 } },
    });
  });

  it("requires the canonical workshop purchase API instead of a second machine inventory", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null, data: null });
    createSupabaseServiceClient.mockReturnValue({ rpc });
    const state = { ...starter, equipment: [...starter.equipment, { code: "GV-GP50-7", quantity: 1 }] };
    await expect(saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, expectedCostCents: 0, state })).rejects.toThrow("atelier de transformation");
    expect(rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_warehouse_receipt", expect.any(Object));
  });

  it("replays historical physical-machine purchases after the shared-workshop conversion", async () => {
    const receipt = { requestKey, revision: 2, investmentCents: 42_549, creditUsedCents: 0, chargedCents: 42_549, replayed: true };
    const rpc = vi.fn().mockResolvedValue({ error: null, data: { ...current(), revision: 3, receipt } });
    createSupabaseServiceClient.mockReturnValue({ rpc });
    const state = { ...starter, equipment: [...starter.equipment, { code: "GV-GP50-7", quantity: 1 }] };
    expect((await saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, expectedCostCents: 42_549, state })).receipt).toEqual(receipt);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("reports removing an adopted physical plan as a client error before spending", async () => {
    const candidate = { ...starter }; delete candidate.serviceZones;
    const rpc = vi.fn().mockImplementation((name: string) => Promise.resolve({ error: null, data: name === "rpc_kq_warehouse_receipt" ? null : current() }));
    createSupabaseServiceClient.mockReturnValue({ rpc });
    await expect(saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, state: candidate, expectedCostCents: 0 })).rejects.toMatchObject({ status: 400 });
    expect(rpc.mock.calls.some(([name]) => name === "rpc_kq_warehouse_save")).toBe(false);
  });

  it("preserves historical capacity without silently adopting service zones", async () => {
    const historical = { ...starter }; delete historical.serviceZones;
    const rpc = vi.fn().mockImplementation((name: string) => Promise.resolve({ error: null,
      data: name === "rpc_kq_warehouse_receipt" ? null : { ...current(), state: historical } }));
    createSupabaseServiceClient.mockReturnValue({ rpc });
    await saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, state: historical, expectedCostCents: 0 });
    expect(rpc.mock.calls.find(([name]) => name === "rpc_kq_warehouse_save")![1].p_next_state).not.toHaveProperty("serviceZones");
    const equipment = historical.equipment.map(item => item.code === "LP-SUPER-1L" ? { ...item, quantity: item.quantity + 1 } : item);
    await expect(saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, state: { ...historical, equipment }, expectedCostCents: 0 })).rejects.toMatchObject({ status: 400 });
    expect(rpc.mock.calls.filter(([name]) => name === "rpc_kq_warehouse_save")).toHaveLength(1);
  });

  it("quotes newly installed drums and translates a concurrent occupancy conflict", async () => {
    const candidate = { ...starter, serviceZones: starter.serviceZones!.map(zone => zone.kind === "storage" ? { ...zone, deviceCode: "CURTEC-60L" } : zone) };
    const quote = getKqWarehouseQuote(candidate, starter);
    const rpc = vi.fn().mockImplementation((name: string) => Promise.resolve(name === "rpc_kq_warehouse_save"
      ? { data: null, error: { message: "warehouse_service_capacity_in_use" } }
      : { error: null, data: name === "rpc_kq_warehouse_receipt" ? null : current() }));
    createSupabaseServiceClient.mockReturnValue({ rpc });
    await expect(saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, state: candidate, expectedCostCents: quote.totalCostCents })).rejects.toMatchObject({ status: 409 });
    expect(rpc.mock.calls.find(([name]) => name === "rpc_kq_warehouse_save")![1]).toMatchObject({
      p_cost_cents: 39_330, p_next_state: { serviceZones: candidate.serviceZones, equipment: expect.arrayContaining([{ code: "CURTEC-60L", quantity: 4 }]) },
    });
  });

  it("keeps reserved whole-container volume separate from actual stock mass", async () => {
    createSupabaseServiceClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ error: null,
      data: { ...current(), stockGrams: 50, storageReservedGrams: 3000, storageCapacityGrams: 12000 } }) });
    expect(await getKqWarehouseSnapshot(userId)).toMatchObject({ stockGrams: 50, storageReservedGrams: 3000, storageCapacityGrams: 12000 });
  });

  it("saves another zone and its assigned Buddie while preserving an occupied zone", async () => {
    const activeRuns = [{ runId: "run-first", zoneId: starter.zones[0].id, buddieCode: "HH2026-001", stageIndex: 0, phase: "planning", startedAt: "now" }];
    const candidate = { ...starter, zones: [...starter.zones, { ...starter.zones[0], id: "free", name: "Libre", x: 3, buddieCode: "HH2026-002" }] };
    const quote = getKqWarehouseQuote(candidate, starter);
    const rpc = vi.fn().mockImplementation(async name => ({ error: null, data: name === "rpc_kq_warehouse_receipt" ? null : { ...current(), activeRun: true, activeRuns } }));
    createSupabaseServiceClient.mockReturnValue({ rpc });
    await saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, state: candidate, expectedCostCents: quote.totalCostCents });
    const args = rpc.mock.calls.find(([name]) => name === "rpc_kq_warehouse_save")![1];
    expect(args.p_next_state.zones[0]).toEqual(starter.zones[0]);
    expect(args.p_next_state.zones[1].buddieCode).toBe("HH2026-002");
  });

  it.each([{ active: false }, { buddieCode: "HH2026-002" }, { name: "Renommée" }])("rejects changes to an occupied zone before spending: %j", async change => {
    const rpc = vi.fn().mockImplementation(async name => ({ error: null, data: name === "rpc_kq_warehouse_receipt" ? null : { ...current(), activeRun: true,
      activeRuns: [{ runId: "run", zoneId: starter.zones[0].id, buddieCode: "HH2026-001", stageIndex: 0, phase: "planning", startedAt: "now" }] } }));
    createSupabaseServiceClient.mockReturnValue({ rpc });
    const candidate = { ...starter, zones: starter.zones.map(zone => ({ ...zone, ...change })) };
    await expect(saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, state: candidate, expectedCostCents: 0 })).rejects.toMatchObject({ status: 409 });
    expect(rpc.mock.calls.some(([name]) => name === "rpc_kq_warehouse_save")).toBe(false);
  });

  it("keeps a legacy run's global lock even when an empty active list is supplied", async () => {
    const rpc = vi.fn().mockImplementation(async name => ({ error: null, data: name === "rpc_kq_warehouse_receipt" ? null : { ...current(), activeRun: true, legacyActiveRun: true, activeRuns: [] } }));
    createSupabaseServiceClient.mockReturnValue({ rpc });
    await expect(saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, state: starter, expectedCostCents: 0 })).rejects.toMatchObject({ status: 409 });
  });
});
