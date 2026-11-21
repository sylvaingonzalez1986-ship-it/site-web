import retail from "../kanab-quest-warehouse-retail-equipment.json";
import { beforeEach, describe, expect, it, vi } from "vitest";
const { createSupabaseServiceClient, getKqStaffSnapshot } = vi.hoisted(() => ({ createSupabaseServiceClient: vi.fn(), getKqStaffSnapshot: vi.fn() }));
vi.mock("./admin", () => ({ createSupabaseServiceClient }));
vi.mock("./kanab-quest-staff-backend", () => ({ getKqStaffSnapshot }));
vi.mock("./kanab-quest-warehouse-flow-backend", () => ({ getKqWarehouseSalesForecast: vi.fn().mockResolvedValue(null) }));
import { compactKqWarehouseToStarterFloor, createKqWarehouseEmpty, createKqWarehouseStarter, getKqWarehouseQuote, type KqWarehouseState } from "../kanab-quest-warehouse";
import { getKqWarehouseProcessingEquipment, getKqWarehouseRunSnapshot, getKqWarehouseSnapshot, saveKqWarehouseLayout } from "./kanab-quest-warehouse-backend";
import { getKqWarehouseSalesForecast } from "./kanab-quest-warehouse-flow-backend";
import { initializeKqWarehouseCondition } from "../kanab-quest-warehouse-condition";
import { createKqCareState } from "../kanab-quest-care";
import { moveKqWarehouseSpatialItem } from "../kanab-quest-warehouse-spatial";

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

  it("reads each active campaign once for the owner and discards health from a different phase", async () => {
    const run = { runId: requestKey, leaderRunId: requestKey, zoneId: "a", stageIndex: 2, phase: "rolled", buddieCode: "HH2026-002", startedAt: "2026-11-17T08:00:00Z" };
    const snapshot = { ...current(), activeRun: true, activeRuns: [run, { ...run, runId: userId, zoneId: "b" }] };
    const rpc = vi.fn().mockResolvedValue({ error: null, data: snapshot });
    const eq = vi.fn();
    const care = { ...createKqCareState(), vitality: 24 };
    const row = { id: requestKey, stage: 2, phase: "rolled", care, outage: true };
    const read = vi.fn().mockResolvedValueOnce({ data: [row] }).mockResolvedValueOnce({ data: [{ ...row, phase: "prepare" }] });
    eq.mockReturnValue({ eq, in: read });
    const from = vi.fn().mockReturnValue({ select: () => ({ eq }) });
    createSupabaseServiceClient.mockReturnValue({ rpc, from });
    const overview = await getKqWarehouseSnapshot(userId, { cultureDetails: true });
    expect(from).toHaveBeenCalledWith("kq_runs");
    expect(eq).toHaveBeenCalledWith("user_id", userId);
    expect(eq).toHaveBeenCalledWith("status", "active");
    expect(read).toHaveBeenCalledWith("id", [requestKey]);
    expect(overview.activeRuns?.map(item => item.roomCare)).toEqual([0, 1].map(() => ({ vitality: 24, attention: "Santé critique", effects: [] })));
    expect(overview.activeRuns?.[0].powerOutage).toBe(true);
    const stale = await getKqWarehouseSnapshot(userId, { cultureDetails: true });
    expect(stale.activeRuns).toEqual(snapshot.activeRuns);
  });

  it("persists only named partition geometry at zero charge and returns it after a fresh server read", async () => {
    let stored: ReturnType<typeof current> & { state: KqWarehouseState } = current();
    const rpc = vi.fn().mockImplementation(async (name, args) => {
      if (name === "rpc_kq_warehouse_receipt") return { error: null, data: null };
      if (name === "rpc_kq_warehouse_save") stored = { ...stored, state: args.p_next_state, revision: 2 };
      return { error: null, data: stored };
    });
    createSupabaseServiceClient.mockReturnValue({ rpc });
    const partition = { id: "stable-wall", x: 2, y: 2, axis: "x" as const, length: 3 };
    await saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, state: {
      ...starter, spatial: { version: 1 }, partitions: [{ ...partition, costCents: 999_999, capacityGrams: 999_999 }],
    }, expectedCostCents: 0 });
    expect(rpc.mock.calls.find(([name]) => name === "rpc_kq_warehouse_save")?.[1]).toMatchObject({
      p_cost_cents: 0, p_expected_revision: 1, p_next_state: { partitions: [partition], equipment: starter.equipment, preparedAreaM2: starter.preparedAreaM2 },
    });
    expect(stored.state.partitions).toEqual([partition]);
    expect(stored.cashCents).toBe(current().cashCents);
    expect((await getKqWarehouseSnapshot(userId, { preserveLayout: true })).state.partitions).toEqual([partition]);
  });

  it("retains saved walls for older 2D payloads and checks new zones against their effective geometry", async () => {
    const state: KqWarehouseState = { ...starter, partitions: [{ id: "wall", x: 2, y: 2, axis: "x", length: 3 }] };
    const rpc = vi.fn().mockImplementation(async name => ({ error: null, data: name === "rpc_kq_warehouse_receipt" ? null : { ...current(), state } }));
    createSupabaseServiceClient.mockReturnValue({ rpc });
    const candidate = { ...state, zones: state.zones.map(zone => ({ ...zone, x: 1, y: 1 })) }; delete candidate.partitions;
    await saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, state: candidate, expectedCostCents: 0 });
    expect(rpc.mock.calls.find(([name]) => name === "rpc_kq_warehouse_save")?.[1].p_next_state.partitions).toEqual(state.partitions);
    const colliding = { ...candidate, zones: candidate.zones.map(zone => ({ ...zone, x: 2, y: 2 })) };
    await expect(saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, state: colliding, expectedCostCents: 0 }))
      .rejects.toMatchObject({ status: 400, message: "Une paroi ne peut pas traverser une zone de culture, de séchage ou de stockage." });
    expect(rpc.mock.calls.filter(([name]) => name === "rpc_kq_warehouse_save")).toHaveLength(1);
  });

  it("copies only known nested fan mount fields and recomputes station service", async () => {
    const base = createKqWarehouseEmpty();
    const rpc = vi.fn().mockImplementation(async (name, args) => ({ error: null, data: name === "rpc_kq_warehouse_receipt"
      ? null : { ...current(), state: name === "rpc_kq_warehouse_save" ? args.p_next_state : base } }));
    createSupabaseServiceClient.mockReturnValue({ rpc });
    const mount = { kind: "wall", face: "east" } as const;
    const fan = { id: "fan", code: "SIM-AIR-01", x: 0, y: 1, mount };
    const station = { id: "pump", code: "SIM-WATER-03", x: 5, y: 2 } as const;
    const candidate = { ...base, airPlacements: [fan], stationPlacements: [station] };
    const quote = getKqWarehouseQuote(candidate, base);
    expect(quote.nextState.airPlacements?.[0].mount).not.toBe(mount);
    const saved = await saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, expectedCostCents: quote.totalCostCents,
      state: { ...candidate, airPlacements: [{ ...fan, mount: { ...mount, invented: true } }],
        stationService: { invented: { waterAreaM2: 99, hygieneAreaM2: 99 } } } });
    expect(saved.state.airPlacements).toEqual([fan]);
    expect(saved.state.stationService).toEqual({});
  });

  it("saves non-overlapping walls without requiring a 3D doorway", async () => {
    const state: KqWarehouseState = { ...starter, serviceZones: [], zones: [{ ...starter.zones[0], x: 4, y: 4 }], partitions: [
      { id: "top", x: 2, y: 2, axis: "x", length: 6 }, { id: "bottom", x: 2, y: 6, axis: "x", length: 6 },
      { id: "left", x: 2, y: 2, axis: "y", length: 5 }, { id: "right-top", x: 7, y: 2, axis: "y", length: 2 },
      { id: "right-bottom", x: 7, y: 5, axis: "y", length: 2 },
    ] };
    const candidate: KqWarehouseState = { ...state, partitions: [...state.partitions!, { id: "closed-door", x: 7, y: 4, axis: "y", length: 1 }] };
    const rpc = vi.fn().mockImplementation(async name => ({ error: null, data: name === "rpc_kq_warehouse_receipt" ? null : { ...current(), state } }));
    createSupabaseServiceClient.mockReturnValue({ rpc });
    await saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, state: candidate, expectedCostCents: 0 });
    expect(rpc.mock.calls.find(([name]) => name === "rpc_kq_warehouse_save")?.[1]).toMatchObject({
      p_next_state: { zones: candidate.zones, partitions: candidate.partitions }, p_cost_cents: 0, p_expected_revision: 1,
    });
  });

  it("persists a free spatial rearrangement through the revision-checked economic RPC", async () => {
    const state = moveKqWarehouseSpatialItem(starter, "starter-drying", { x: -1.5, z: -1.5, rotation: 90 });
    const rpc = vi.fn().mockImplementation(async name => ({ error: null, data: name === "rpc_kq_warehouse_receipt" ? null : current() }));
    createSupabaseServiceClient.mockReturnValue({ rpc });
    await saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, state, expectedCostCents: 0 });
    expect(rpc.mock.calls.find(([name]) => name === "rpc_kq_warehouse_save")?.[1]).toMatchObject({
      p_expected_revision: 1, p_previous_state: starter, p_next_state: state, p_cost_cents: 0,
      p_request: { state, expectedRevision: 1, expectedCostCents: 0 },
    });
  });

  it("preserves a valid historical layout when the interior requests it", async () => {
    const state = legacyFloor();
    const rpc = vi.fn().mockResolvedValue({ error: null, data: { ...current(), state } });
    createSupabaseServiceClient.mockReturnValue({ rpc });
    expect((await getKqWarehouseSnapshot(userId, { preserveLayout: true })).state).toEqual(state);
    expect(rpc.mock.calls.some(([name]) => name === "rpc_kq_warehouse_compact")).toBe(false);
  });

  it("keeps busy-zone and stale-revision locks on purely spatial moves", async () => {
    const state = moveKqWarehouseSpatialItem(starter, "starter", { x: -1.5, z: -1.5, rotation: 90 });
    const rpc = vi.fn().mockImplementation(async name => ({ error: null, data: name === "rpc_kq_warehouse_receipt" ? null : { ...current(), activeRun: true, activeRuns: [{ zoneId: "starter" }] } }));
    createSupabaseServiceClient.mockReturnValue({ rpc });
    await expect(saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, state, expectedCostCents: 0 })).rejects.toMatchObject({ status: 409 });
    await expect(saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 2, state, expectedCostCents: 0 })).rejects.toMatchObject({ status: 409 });
    expect(rpc.mock.calls.some(([name]) => name === "rpc_kq_warehouse_save")).toBe(false);
  });

  it("allows free footprints during a zone culture without modifying its immutable source zone", async () => {
    const state = moveKqWarehouseSpatialItem(starter, "starter-drying", { x: -1.5, z: -1.5, rotation: 90 });
    const rpc = vi.fn().mockImplementation(async name => ({ error: null, data: name === "rpc_kq_warehouse_receipt" ? null : { ...current(), activeRun: true, activeRuns: [{ zoneId: "starter" }] } }));
    createSupabaseServiceClient.mockReturnValue({ rpc });
    await saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, state, expectedCostCents: 0 });
    expect(rpc.mock.calls.find(([name]) => name === "rpc_kq_warehouse_save")?.[1]).toMatchObject({
      p_next_state: { zones: starter.zones, serviceZones: state.serviceZones }, p_cost_cents: 0,
    });
  });

  it.each(["player", "employee"])("allows the airlock to be stored and reinstalled during %s production", async actor => {
    const zone = { ...starter.zones[0], id: "main", active: true, x: 5, y: 6, width: 4, height: 1 };
    const airlock = { id: "airlock", code: "SIM-HYGIENE-03", x: 5, y: 9 } as const;
    let plan = getKqWarehouseQuote({ ...createKqWarehouseEmpty(), zones: [zone], stationPlacements: [airlock] }).nextState;
    const busy = actor === "player" ? { activeRun: true, activeRuns: [{ zoneId: zone.id }] }
      : { productionReservation: { zoneId: zone.id, enabled: true, equipmentEditable: false } };
    const rpc = vi.fn().mockImplementation(async (name, args) => {
      if (name === "rpc_kq_warehouse_receipt") return { data: null, error: null };
      if (name === "rpc_kq_warehouse_save") plan = args.p_next_state;
      return { data: { ...current(), state: plan, ...busy }, error: null };
    });
    createSupabaseServiceClient.mockReturnValue({ rpc });
    expect(plan.stationService?.main.hygieneAreaM2).toBe(4);
    for (const stationPlacements of [[], [airlock]]) {
      await saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, state: { ...plan, stationPlacements }, expectedCostCents: 0 });
      expect(plan.stationPlacements).toEqual(stationPlacements);
    }
    expect(getKqStaffSnapshot).not.toHaveBeenCalled();
  });

  it("saves adjacent 2D zones without requiring a passage around an enclosed zone", async () => {
    const zone = (id: string, x: number, y: number, width: number, height: number) => ({ ...starter.zones[0], id, name: id, x, y, width, height });
    const state = getKqWarehouseQuote({ ...starter, serviceZones: [], zones: [zone("inner", 4, 4, 1, 1), zone("left", 3, 3, 1, 3), zone("right", 5, 3, 1, 3), zone("top", 4, 3, 1, 1), zone("bottom", 4, 7, 1, 1)] }).nextState;
    const candidate = { ...state, zones: state.zones.map(item => item.id === "bottom" ? { ...item, y: 5 } : item) };
    const rpc = vi.fn().mockImplementation(async name => ({ error: null, data: name === "rpc_kq_warehouse_receipt" ? null : { ...current(), state } }));
    createSupabaseServiceClient.mockReturnValue({ rpc });
    await saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, state: candidate, expectedCostCents: 0 });
    expect(rpc.mock.calls.find(([name]) => name === "rpc_kq_warehouse_save")?.[1]).toMatchObject({
      p_next_state: { zones: candidate.zones }, p_cost_cents: 0, p_expected_revision: 1,
    });
  });

  it("settles idle enabled production then uses the atomic equipment RPC with unchanged player settings", async () => {
    const cultureEquipment = initializeKqWarehouseCondition(starter, true);
    const productionReservation = { zoneId: "starter", enabled: true, equipmentEditable: true };
    const settings = { enabled: true, zoneId: "starter", maxDailyCostCents: 100_000 };
    getKqStaffSnapshot.mockResolvedValue({ revision: 7, state: { production: { settings, facility: { zoneId: "starter" }, lots: [], jobs: [], advancedAt: "2026-11-11T10:00:00.000Z" } }, context: {
      productionVersion: 1, productionFacility: { warehouseState: starter, warehouseRevision: 1, usedStorageGrams: 0, reservedDryingGrams: 0, busyZoneIds: [], equipment: [] },
    } });
    const rpc = vi.fn().mockImplementation(async name => ({ error: null, data: name === "rpc_kq_warehouse_receipt" ? null : { ...current(), cultureEquipment, productionReservation } }));
    createSupabaseServiceClient.mockReturnValue({ rpc });
    const next = { ...starter, zones: starter.zones.map(zone => ({ ...zone, optionCodes: ["SIM-WATER-01"] })) };
    const quote = getKqWarehouseQuote(next, starter);
    await saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, state: next, expectedCostCents: quote.totalCostCents });
    expect(getKqStaffSnapshot).toHaveBeenCalledWith(userId);
    expect(rpc.mock.calls.find(([name]) => name === "rpc_kq_warehouse_save_production_equipment")?.[1]).toMatchObject({
      p_expected_staff_revision: 7, p_settled_at: "2026-11-11T10:00:00.000Z", p_cost_cents: quote.totalCostCents, p_next_state: quote.nextState,
    });
    expect(settings).toEqual({ enabled: true, zoneId: "starter", maxDailyCostCents: 100_000 });
    getKqStaffSnapshot.mockResolvedValueOnce({ revision: 8, state: { production: { facility: {}, lots: [{}], jobs: [] } } });
    await expect(saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, state: next, expectedCostCents: quote.totalCostCents })).rejects.toMatchObject({ status: 409 });
    expect(rpc.mock.calls.filter(([name]) => name === "rpc_kq_warehouse_save_production_equipment")).toHaveLength(1);
  });

  it.each([true, false])("publishes the occupied commercial zone, skips compaction and blocks its individual quote (enabled=%s)", async enabled => {
    const state = legacyFloor(), productionReservation = { zoneId: "starter", enabled };
    const rpc = vi.fn().mockResolvedValue({ error: null, data: { ...current(), state, productionReservation } });
    createSupabaseServiceClient.mockReturnValue({ rpc });
    expect(await getKqWarehouseSnapshot(userId)).toMatchObject({ productionReservation, state });
    expect(await getKqWarehouseRunSnapshot(userId)).toMatchObject({ productionReservedZoneId: "starter", sourceState: state });
    await expect(getKqWarehouseRunSnapshot(userId, "starter")).rejects.toMatchObject({ status: 409 });
    expect(rpc.mock.calls.some(([name]) => name === "rpc_kq_warehouse_compact")).toBe(false);
  });

  it("keeps explicit release separate from older snapshots without reservation metadata", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null, data: { ...current(), productionReservation: null } });
    createSupabaseServiceClient.mockReturnValue({ rpc });
    expect(await getKqWarehouseRunSnapshot(userId, "starter")).toMatchObject({ productionReservedZoneId: null });
    rpc.mockResolvedValue({ error: null, data: current() });
    expect(await getKqWarehouseRunSnapshot(userId, "starter")).not.toHaveProperty("productionReservedZoneId");
  });

  it.each([{ zoneId: "starter", enabled: "false" }, { zoneId: "unknown", enabled: true }, [], false])("rejects malformed commercial reservation metadata: %j", async productionReservation => {
    createSupabaseServiceClient.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ error: null, data: { ...current(), productionReservation } }) });
    await expect(getKqWarehouseSnapshot(userId)).rejects.toThrow("invalid_snapshot");
  });

  it("refuses a Buddie assignment in the reserved zone before saving but preserves replayed receipts", async () => {
    const productionReservation = { zoneId: "starter", enabled: false };
    const rpc = vi.fn().mockImplementation(async name => ({ error: null, data: name === "rpc_kq_warehouse_receipt" ? null : { ...current(), productionReservation } }));
    createSupabaseServiceClient.mockReturnValue({ rpc });
    const state = { ...starter, zones: starter.zones.map(zone => ({ ...zone, buddieCode: "HH2026-002" })) };
    await expect(saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, state, expectedCostCents: 0 })).rejects.toMatchObject({ status: 409 });
    expect(rpc.mock.calls.some(([name]) => name === "rpc_kq_warehouse_save")).toBe(false);
    rpc.mockResolvedValue({ error: null, data: { ...current(), productionReservation, receipt: { requestKey, replayed: true } } });
    expect(await saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, state, expectedCostCents: 0 })).toMatchObject({ productionReservation, receipt: { replayed: true } });
  });

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

  it("reloads occupancy when a commercial reservation wins the compaction race", async () => {
    const state = legacyFloor(), productionReservation = { zoneId: "starter", enabled: true };
    let reserved = false;
    const rpc = vi.fn().mockImplementation(async (name: string) => {
      if (name === "rpc_kq_warehouse_compact") {
        reserved = true;
        return { data: null, error: { message: "staff_production_occupied" } };
      }
      return { error: null, data: { ...current(), state, productionReservation: reserved ? productionReservation : null } };
    });
    createSupabaseServiceClient.mockReturnValue({ rpc });
    expect(await getKqWarehouseRunSnapshot(userId)).toMatchObject({ sourceState: state, productionReservedZoneId: "starter" });
    expect(rpc.mock.calls.filter(([name]) => name === "rpc_kq_warehouse_compact")).toHaveLength(1);
    expect(rpc.mock.calls.filter(([name]) => name === "rpc_kq_warehouse_snapshot")).toHaveLength(2);
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
    const candidate = { ...starter, zones: starter.zones.map(zone => ({ ...zone, optionCodes: ["SIM-CONTROL-UNIT-01", "SIM-CLIMATE-UNIT-02"], qualityBonus: 999 })),
      optionInventory: [{ code: "SIM-CONTROL-UNIT-01", quantity: 1, discountCents: 99999 }] };
    const quote = getKqWarehouseQuote(candidate, starter);
    const rpc = vi.fn().mockImplementation((name: string) => Promise.resolve({ error: null,
      data: name === "rpc_kq_warehouse_receipt" ? null : name === "rpc_kq_warehouse_save" ? { ...current(), revision: 2, state: quote.nextState } : current() }));
    createSupabaseServiceClient.mockReturnValue({ rpc });
    await saveKqWarehouseLayout({ userId, requestKey, expectedRevision: 1, state: candidate, expectedCostCents: quote.totalCostCents });
    const args = rpc.mock.calls.find(([name]) => name === "rpc_kq_warehouse_save")![1];
    expect(args.p_cost_cents).toBe(Math.round(retail["SIM-CLIMATE-UNIT-02"].unitPriceCents * 1.15) + retail["SIM-CONTROL-UNIT-01"].unitPriceCents);
    expect(args.p_next_state.optionInventory).toEqual([{ code: "SIM-CLIMATE-UNIT-02", quantity: 1 }, { code: "SIM-CONTROL-UNIT-01", quantity: 1 }]);
    expect(args.p_next_state.zones[0].optionCodes).toEqual(["SIM-CLIMATE-UNIT-02", "SIM-CONTROL-UNIT-01"]);
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

  it("initializes the empty warehouse and blocks a new run before furnishing it", async () => {
    const empty = createKqWarehouseEmpty();
    const rpc = vi.fn().mockImplementation((name: string) => Promise.resolve({ error: null,
      data: name === "rpc_kq_warehouse_initialize_onboarding" ? { ...current(), state: empty }
        : { ...current(), state: null, revision: 0 } }));
    createSupabaseServiceClient.mockReturnValue({ rpc });
    await expect(getKqWarehouseRunSnapshot(userId)).rejects.toThrow("Active au moins une zone");
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["rpc_kq_warehouse_snapshot", "rpc_kq_warehouse_initialize_onboarding"]);
    expect(rpc).toHaveBeenCalledWith("rpc_kq_warehouse_initialize_onboarding", {
      p_user_id: userId, p_starter_state: createKqWarehouseStarter(true), p_empty_state: empty,
    });
  });

  it("converts before commerce settlement can sell legacy overflow automatically", async () => {
    const order: string[] = [];
    let converted = false;
    const rpc = vi.fn().mockImplementation((name: string) => {
      order.push(name);
      if (name === "rpc_kq_warehouse_initialize_onboarding") converted = true;
      return Promise.resolve({ error: null, data: converted ? current() : { ...current(), state: null, revision: 0 } });
    });
    createSupabaseServiceClient.mockReturnValue({ rpc });
    vi.mocked(getKqWarehouseSalesForecast).mockImplementationOnce(async () => {
      order.push("commerce-forecast");
      throw new Error("forecast temporarily unavailable");
    });
    expect(await getKqWarehouseSnapshot(userId)).toMatchObject({ state: starter, revision: 1 });
    expect(order).toEqual(["rpc_kq_warehouse_snapshot", "rpc_kq_warehouse_initialize_onboarding", "commerce-forecast", "rpc_kq_warehouse_snapshot"]);
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
      p_cost_cents: Math.round(4 * retail["CURTEC-60L"].unitPriceCents * 1.15), p_next_state: { serviceZones: candidate.serviceZones, equipment: expect.arrayContaining([{ code: "CURTEC-60L", quantity: 4 }]) },
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
