import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ client: vi.fn(), warehouse: vi.fn(), equipment: vi.fn() }));
vi.mock("./admin", () => ({ createSupabaseServiceClient: mocks.client }));
vi.mock("./kanab-quest-warehouse-backend", () => ({ getKqWarehouseRunSnapshot: mocks.warehouse }));
vi.mock("./kanab-quest-equipment-backend", () => ({ getKqEquipmentShopSnapshot: mocks.equipment }));

import { getKqPlayerRunsSnapshot, mapKqPlayerCoreSnapshot, readKqRunSelection, startKqPlayerRun } from "./kanab-quest-backend";
import { KQ_ACTIVE_CARDS, KQ_CARDS, startKqGame } from "../kanab-quest-game";
import { createKqWarehouseStarter, getKqWarehouseQuote, getKqWarehouseRunSnapshot } from "../kanab-quest-warehouse";

const owner = "11000000-0000-4000-8000-000000000001";
const stranger = "11000000-0000-4000-8000-000000000002";
const requestKey = "22000000-0000-4000-8000-000000000001";
const firstId = "33000000-0000-4000-8000-000000000001";
const secondId = "33000000-0000-4000-8000-000000000002";
const buddie = "HH2026-001";
const starter = createKqWarehouseStarter();
const layout = getKqWarehouseQuote({ ...starter, zones: [
  { ...starter.zones[0], buddieCode: buddie },
  { ...starter.zones[0], id: "other", name: "Autre zone", x: 3, buddieCode: "HH2026-002" },
] }, starter).nextState;
const zoneId = layout.zones[0].id;
const warehouse = getKqWarehouseRunSnapshot(layout, 4, zoneId);
const game = (zone = zoneId) => startKqGame(71, { warehouse: getKqWarehouseRunSnapshot(layout, 4, zone), varietyCode: zone === zoneId ? buddie : "HH2026-002" });
type Row = Record<string, unknown>;
const row = (id: string, zone = zoneId, userId = owner, status = "active") => ({ id, user_id: userId, status, state: game(zone), started_at: "2026-10-13T12:00:00Z", updated_at: "2026-10-13T12:00:00Z" });

function database(options: { runs?: Row[]; replay?: unknown; receiptError?: string; startError?: string; recent?: string[] } = {}) {
  const reads: Array<{ table: string; filters: Array<[string, unknown]> }> = [];
  const rpc = vi.fn().mockImplementation(async (name: string, args: Record<string, unknown> = {}) => {
    if (name === "rpc_kq_zone_run_receipt") return { data: options.replay ?? null, error: options.receiptError ? { message: options.receiptError } : null };
    if (name === "rpc_kq_reserved_cards") return { data: [], error: null };
    if (name === "rpc_kq_commerce_state") return { data: { business: { version: 1, domiciliation: { mode: "home", active: true } } }, error: null };
    return { data: { run: { id: firstId, state: args.p_initial_state }, burnReceipt: null, replayed: false }, error: options.startError ? { message: options.startError } : null };
  });
  mocks.client.mockReturnValue({ rpc, from: (table: string) => {
    const read = { table, filters: [] as Array<[string, unknown]> }; reads.push(read);
    let data: unknown = table === "kq_runs" ? options.runs ?? []
      : table === "kq_buddie_rotation" ? { recent_buddie_codes: options.recent ?? [] }
      : table === "lottery_card_collections" ? { id: "catalog", is_active: true }
      : table === "kq_culture_token_wallets" ? { balance: 2 } : [];
    const query = { select: () => query, order: () => query, limit: () => query, maybeSingle: () => query,
      eq: (key: string, value: unknown) => { read.filters.push([key, value]); if (Array.isArray(data)) data = data.filter(entry => entry[key] === value); return query; },
      in: (key: string, values: unknown[]) => { if (Array.isArray(data)) data = data.filter(entry => values.includes(entry[key])); return query; },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve),
    }; return query;
  } });
  return { rpc, reads };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.warehouse.mockResolvedValue(warehouse);
  mocks.equipment.mockResolvedValue({ strength: null, equippedCodes: [], levels: {}, tents: [], sharedEquipment: { equippedCodes: [], levels: {} } });
});

describe("owned zone culture reads", () => {
  it("returns all owned active runs without silently selecting one of several", async () => {
    const { reads } = database({ runs: [row(firstId), row(secondId, "other"), row("foreign", zoneId, stranger)] });
    const result = await getKqPlayerRunsSnapshot(owner);
    expect(result.activeRun).toBeNull();
    expect(result.activeRuns.map(run => [run.runId, run.zoneId])).toEqual([[firstId, zoneId], [secondId, "other"]]);
    expect(reads.filter(read => read.table === "kq_runs" || read.table === "kq_card_burn_receipts").every(read => read.filters.some(([key, value]) => key === "user_id" && value === owner))).toBe(true);
  });

  it("selects one zone and requires runId and zoneId to match when both are supplied", async () => {
    database({ runs: [row(firstId), row(secondId, "other")] });
    expect((await getKqPlayerRunsSnapshot(owner, { zoneId: "other" })).activeRun?.runId).toBe(secondId);
    expect((await getKqPlayerRunsSnapshot(owner, { runId: firstId, zoneId: "other" })).activeRun).toBeNull();
  });

  it("reopens a completed owned run without adding it to active runs or exposing another account", async () => {
    database({ runs: [row(firstId, zoneId, owner, "completed"), row(secondId, "other", stranger, "completed")] });
    expect(await getKqPlayerRunsSnapshot(owner, { runId: firstId })).toMatchObject({ activeRun: { runId: firstId }, activeRuns: [] });
    expect(await getKqPlayerRunsSnapshot(owner, { runId: secondId })).toEqual({ activeRun: null, activeRuns: [] });
  });

  it("applies the same explicit selection to consolidated snapshots", () => {
    const activeRuns = [firstId, secondId].map((runId, index) => ({ runId, state: game(index ? "other" : zoneId), startedAt: "now", updatedAt: "now" }));
    expect(mapKqPlayerCoreSnapshot({ activeRuns }).activeRun).toBeNull();
    expect(mapKqPlayerCoreSnapshot({ activeRuns }, [], [], { zoneId: "other" }).activeRun?.runId).toBe(secondId);
  });

  it("rejects malformed selection before a query", () => {
    expect(() => readKqRunSelection(new Request("http://localhost/runs?runId=not-a-uuid"))).toThrow("invalide");
    expect(() => readKqRunSelection(new Request("http://localhost/runs?zoneId="))).toThrow("invalide");
    expect(readKqRunSelection(new Request(`http://localhost/runs?runId=${firstId}&zoneId=starter`))).toEqual({ runId: firstId, zoneId: "starter" });
  });
});

describe("idempotent zone launch boundary", () => {
  it("validates the zone request key before touching the database", async () => {
    await expect(startKqPlayerRun(owner, { zoneId, buddieCode: buddie, deckCodes: [] })).rejects.toThrow("Clé");
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("replays the persisted state before checking changed rotation, installation or drawing a seed", async () => {
    const state = game();
    const { rpc } = database({ recent: [buddie], replay: { run: { id: firstId, state }, freeSubstrate: true, burnReceipt: null, replayed: true } });
    const result = await startKqPlayerRun(owner, { zoneId, requestKey, buddieCode: buddie, deckCodes: [] });
    expect(result).toMatchObject({ runId: firstId, state, replayed: true });
    expect(mocks.warehouse).not.toHaveBeenCalled();
    expect(mocks.equipment).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_zone_run_receipt", { p_user_id: owner, p_request_key: requestKey,
      p_request: { zoneId, buddieCode: buddie, deckCodes: [], cultureTokens: 0, heritageCode: null, energyMode: "balanced", expectedEnergyCents: null } });
  });

  it("refuses reuse of a request key for a different intention", async () => {
    const { rpc } = database({ receiptError: "kq_zone_request_mismatch" });
    await expect(startKqPlayerRun(owner, { zoneId, requestKey, buddieCode: buddie, deckCodes: [] })).rejects.toThrow("autre culture");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(mocks.warehouse).not.toHaveBeenCalled();
  });

  it("starts the selected zone using a full saved source and zone-only energy", async () => {
    const { rpc } = database();
    const result = await startKqPlayerRun(owner, { zoneId, requestKey, buddieCode: buddie, deckCodes: [], expectedEnergyCents: warehouse.energyCostCents });
    expect(mocks.warehouse).toHaveBeenCalledWith(owner, zoneId);
    expect(result.state.warehouse).toMatchObject({ version: 2, zoneId, sourceState: layout, zones: [layout.zones[0]], activeAreaM2: 1 });
    expect(rpc).toHaveBeenCalledWith("rpc_kq_start_zone_run", expect.objectContaining({ p_user_id: owner, p_zone_id: zoneId, p_request_key: requestKey, p_initial_state: result.state }));
  });

  it("rejects a stale Buddie assignment before starting", async () => {
    const { rpc } = database();
    await expect(startKqPlayerRun(owner, { zoneId, requestKey, buddieCode: "HH2026-002", deckCodes: [] })).rejects.toThrow("affectation");
    expect(rpc.mock.calls.some(([name]) => name === "rpc_kq_start_zone_run")).toBe(false);
  });

  it("keeps order and duplicate cards identical in the canonical request and persisted deck", async () => {
    const { rpc } = database();
    const cards = KQ_ACTIVE_CARDS.filter(card => card.category !== "pbi");
    const deckCodes = [cards[1].code, cards[0].code, cards[1].code];
    await startKqPlayerRun(owner, { zoneId, requestKey, buddieCode: buddie, deckCodes, energyMode: "eco" });
    const args = rpc.mock.calls.find(([name]) => name === "rpc_kq_start_zone_run")![1];
    expect(args.p_request).toMatchObject({ deckCodes, energyMode: "balanced" });
    expect(args.p_deck_codes).toEqual(deckCodes);
    expect(args.p_initial_state.deckCodes).toEqual(deckCodes);
  });

  it("rejects archived care cards instead of changing the deck after signing the intention", async () => {
    const { rpc } = database();
    const archived = KQ_CARDS.find(card => !KQ_ACTIVE_CARDS.some(active => active.code === card.code))!;
    await expect(startKqPlayerRun(owner, { zoneId, requestKey, buddieCode: buddie, deckCodes: [archived.code] })).rejects.toThrow("indisponible");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(mocks.warehouse).not.toHaveBeenCalled();
  });

  it.each([['warehouse_zone_busy', 'déjà une culture'], ['kq_buddie_busy', 'déjà à une autre'], ['kq_deck_copy_reserved', 'réservées']])("translates the atomic conflict %s", async (code, message) => {
    database({ startError: code });
    await expect(startKqPlayerRun(owner, { zoneId, requestKey, buddieCode: buddie, deckCodes: [] })).rejects.toThrow(message);
  });
});
