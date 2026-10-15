import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn(), warehouse: vi.fn(), equipment: vi.fn() }));
vi.mock("./admin", () => ({ createSupabaseServiceClient: mocks.client }));
vi.mock("./kanab-quest-warehouse-backend", () => ({ getKqWarehouseRunSnapshot: mocks.warehouse }));
vi.mock("./kanab-quest-equipment-backend", () => ({ getKqEquipmentShopSnapshot: mocks.equipment }));
import { applyKqPlayerRunAction, getKqPlayerRunsSnapshot, startKqPlayerRun } from "./kanab-quest-backend";
import { advanceKqStage, isKqCultureDead, resolveKqStage, rollKqDice, startKqGame, type KqGameState } from "../kanab-quest-game";
import { getKqCampaignMemberState, getKqCampaignParticipants, getKqCampaignTotals } from "../kanab-quest-campaign";
import { createKqWarehouseStarter, getKqWarehouseQuote, getKqWarehouseRunSnapshot } from "../kanab-quest-warehouse";
import { encodeKqSave, parseKqGameSave } from "../kanab-quest-persistence";
const owner = "11000000-0000-4000-8000-000000000001";
const requestKey = "22000000-0000-4000-8000-000000000001";
const ids = ["33000000-0000-4000-8000-000000000001", "33000000-0000-4000-8000-000000000002"];
const starter = createKqWarehouseStarter();
const layout = getKqWarehouseQuote({ ...starter, zones: [
  { ...starter.zones[0], id: "a", buddieCode: "HH2026-002" },
  { ...starter.zones[0], id: "b", x: 3, buddieCode: "HH2026-003" },
  { ...starter.zones[0], id: "unassigned", x: 6 },
] }, starter).nextState;
const warehouse = getKqWarehouseRunSnapshot(layout, 4);
const members = getKqCampaignParticipants(layout, 4).map((member, index) => ({ ...member, runId: ids[index] }));
function game(seed = 71) {
  const state = startKqGame(seed, { varietyCode: members[0].buddieCode, deckCodes: [],
    warehouse: members[0].warehouse, cultivationProfile: members[0].cultivationProfile });
  state.campaign = { version: 1, id: requestKey, leaderRunId: ids[0], members };
  return state;
}
function readyToHarvest() {
  for (let seed = 1; seed < 1000; seed++) {
    let state = game(seed);
    for (let stage = 0; stage < 6 && state.phase !== "complete"; stage++) {
      state = resolveKqStage(rollKqDice(state));
      if (stage !== 5) state = advanceKqStage(state);
    }
    if (!isKqCultureDead(state) && state.stageIndex === 5 && state.phase === "resolved") return state;
  }
  throw new Error("No harvest fixture found");
}
type Row = Record<string, unknown>;
function row(index: number, state = game(), status = "active", userId = owner): Row {
  return { id: ids[index], state: getKqCampaignMemberState(state, members[index]), status, user_id: userId,
    started_at: "2026-10-13T12:00:00Z", updated_at: "2026-10-13T12:00:00Z" };
}
function database(options: { runs?: Row[]; flowers?: Row[]; replay?: unknown; error?: string } = {}) {
  const reads: Array<{ table: string; columns: string; filters: Array<[string, unknown]>; returnedRows: number }> = [];
  const rpc = vi.fn().mockImplementation(async (name: string, args: Record<string, unknown> = {}) => {
    if (name === "rpc_kq_campaign_receipt") return { data: options.replay ?? null, error: null };
    if (name === "rpc_kq_reserved_cards") return { data: [], error: null };
    if (name === "rpc_kq_commerce_state") return { data: { business: { version: 1, domiciliation: { mode: "home", active: true } } }, error: null };
    if (options.error) return { data: null, error: { message: options.error } };
    const payload = args.p_members as Array<{ runId: string; state: KqGameState; flower?: unknown }>;
    if (name === "rpc_kq_start_campaign") return { data: { run: { id: payload[0].runId, state: payload[0].state }, freeSubstrate: true, burnReceipt: null }, error: null };
    return { data: { state: args.p_next_state, flower: null, flowers: payload.filter(member => member.flower).map(member => ({
      id: `flower-${member.runId}`, run_id: member.runId, status: "available", created_at: "now",
    })) }, error: null };
  });
  mocks.client.mockReturnValue({ rpc, from: (table: string) => {
    const read = { table, columns: "", filters: [] as Array<[string, unknown]>, returnedRows: 0 }; reads.push(read);
    let single = false;
    let data: unknown = table === "kq_runs" ? options.runs ?? []
      : table === "kq_flowers" ? options.flowers ?? []
      : table === "kq_buddie_rotation" ? { recent_buddie_codes: [] }
      : table === "lottery_card_collections" ? { id: "catalog", is_active: true }
      : table === "kq_culture_token_wallets" ? { balance: 2 } : [];
    const query = { select: (columns: string) => { read.columns = columns; return query; }, order: () => query, limit: () => query,
      maybeSingle: () => { single = true; return query; },
      eq: (key: string, value: unknown) => { read.filters.push([key, value]); if (Array.isArray(data)) data = data.filter(entry => entry[key] === value); return query; },
      in: (key: string, values: unknown[]) => { read.filters.push([key, values]); if (Array.isArray(data)) data = data.filter(entry => values.includes(entry[key])); return query; },
      then: (resolve: (value: unknown) => unknown) => {
        read.returnedRows = Array.isArray(data) ? data.length : data ? 1 : 0;
        const projected = read.columns.includes("campaign_leader_id:") && Array.isArray(data)
          ? data.map(entry => ({ id: entry.id, campaign_leader_id: (entry.state as KqGameState)?.campaign?.leaderRunId ?? null })) : data;
        return Promise.resolve({ data: single && Array.isArray(projected) ? projected[0] ?? null : projected, error: null }).then(resolve);
      },
    }; return query;
  } });
  return Object.assign(rpc, { reads });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.warehouse.mockResolvedValue(warehouse);
  mocks.equipment.mockResolvedValue({ strength: null, equippedCodes: [], levels: {}, tents: [], sharedEquipment: { equippedCodes: [], levels: {} } });
});

describe("shared campaign backend", () => {
  it("starts all assigned zones through one atomic RPC and one shared deck", async () => {
    const rpc = database();
    const result = await startKqPlayerRun(owner, { campaign: true, requestKey, buddieCode: members[0].buddieCode,
      deckCodes: [], expectedEnergyCents: getKqCampaignTotals(members).energyCostCents });
    const args = rpc.mock.calls.find(([name]) => name === "rpc_kq_start_campaign")![1];
    expect(args.p_members).toHaveLength(2);
    expect(args.p_request).toMatchObject({ campaign: true, deckCodes: [], cultureTokens: 0 });
    expect(args.p_members.map((member: { state: KqGameState }) => member.state.warehouse?.zoneId)).toEqual(["a", "b"]);
    expect(args.p_members[0].state.situationCodes).toEqual(args.p_members[1].state.situationCodes);
    expect(args.p_members[0].state.xp).toBe(args.p_members[1].state.xp);
    expect(parseKqGameSave(encodeKqSave(result.state))).toEqual(result.state);
    expect(rpc.mock.calls.some(([name]) => name === "rpc_kq_start_zone_run")).toBe(false);
  });
  it("replays the campaign before re-reading the changed warehouse or drawing new IDs", async () => {
    const state = game();
    database({ replay: { run: { id: ids[0], state }, replayed: true } });
    expect(await startKqPlayerRun(owner, { campaign: true, requestKey, buddieCode: members[0].buddieCode, deckCodes: [] }))
      .toMatchObject({ runId: ids[0], state, replayed: true });
    expect(mocks.warehouse).not.toHaveBeenCalled();
  });
  it("requires a request key and rejects mixed individual/campaign intention before SQL", async () => {
    database();
    await expect(startKqPlayerRun(owner, { campaign: true, buddieCode: members[0].buddieCode, deckCodes: [] })).rejects.toThrow("Clé");
    await expect(startKqPlayerRun(owner, { campaign: true, requestKey, zoneId: "a", buddieCode: members[0].buddieCode, deckCodes: [] })).rejects.toThrow("toutes les zones");
  });
  it("rejects an individual-zone electrical quote for the combined launch", async () => {
    const rpc = database();
    await expect(startKqPlayerRun(owner, { campaign: true, requestKey, buddieCode: members[0].buddieCode,
      deckCodes: [], expectedEnergyCents: members[0].warehouse.energyCostCents })).rejects.toThrow("devis électrique");
    expect(rpc.mock.calls.some(([name]) => name === "rpc_kq_start_campaign")).toBe(false);
  });
  it("resolves every active member selection to the same canonical run", async () => {
    database({ runs: [row(0), row(1)] });
    for (const selection of [{}, { zoneId: "b" }, { runId: ids[1] }]) {
      const snapshot = await getKqPlayerRunsSnapshot(owner, selection);
      expect(snapshot.activeRun?.runId).toBe(ids[0]);
      expect(snapshot.activeRuns.map(run => run.runId)).toEqual([ids[0]]);
    }
  });
  it("loads one full state for 52 members while preserving access through the last zone", async () => {
    const largeLayout = getKqWarehouseQuote({ ...starter, zones: Array.from({ length: 52 }, (_, index) => ({
      ...starter.zones[0], id: `zone-${String(index).padStart(2, "0")}`, x: index % 10, y: Math.floor(index / 10),
      buddieCode: `HH2026-${String(index + 1).padStart(3, "0")}`,
    })) }).nextState;
    const participants = getKqCampaignParticipants(largeLayout, 1).map((member, index) => ({ ...member,
      runId: `44000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}` }));
    const leader = startKqGame(71, { warehouse: participants[0].warehouse, varietyCode: participants[0].buddieCode,
      cultivationProfile: participants[0].cultivationProfile });
    leader.campaign = { version: 1, id: requestKey, leaderRunId: participants[0].runId, members: participants };
    const runs = participants.map(member => ({ id: member.runId, user_id: owner, status: "active",
      state: getKqCampaignMemberState(leader, member), started_at: "now", updated_at: "now" }));
    const rpc = database({ runs });
    const started = performance.now();
    const snapshot = await getKqPlayerRunsSnapshot(owner, { zoneId: participants[51].zoneId });
    const elapsed = Math.round(performance.now() - started);
    expect(snapshot.activeRun?.runId).toBe(participants[0].runId);
    expect(snapshot.activeRuns).toHaveLength(1);
    const runReads = rpc.reads.filter(read => read.table === "kq_runs");
    expect(runReads.map(read => [read.columns, read.returnedRows])).toEqual([
      ["id,campaign_leader_id:state->campaign->>leaderRunId", 52], ["id,state,started_at,updated_at", 1],
    ]);
    expect(runReads.every(read => read.filters.some(([key, value]) => key === "user_id" && value === owner))).toBe(true);
    const optimizedBytes = Buffer.byteLength(JSON.stringify(snapshot));
    const previousBytes = Buffer.byteLength(JSON.stringify({ activeRun: runs[0], activeRuns: runs }));
    expect(optimizedBytes).toBeLessThan(previousBytes / 20);
    console.info(`Campaign 52-zone read: ${previousBytes} -> ${optimizedBytes} bytes; ${elapsed} ms; 1 full state.`);
  });
  it("keeps historical individual runs while collapsing a shared campaign", async () => {
    const historicalId = "33000000-0000-4000-8000-000000000090";
    database({ runs: [row(0), row(1), { id: historicalId, user_id: owner, status: "active",
      state: startKqGame(72), started_at: "now", updated_at: "now" }] });
    const snapshot = await getKqPlayerRunsSnapshot(owner);
    expect(snapshot.activeRuns.map(run => run.runId)).toEqual([ids[0], historicalId]);
    expect(snapshot.activeRun).toBeNull();
  });
  it("rechecks ownership when metadata points at a different account's leader", async () => {
    const rpc = database({ runs: [row(1), row(0, game(), "active", "11000000-0000-4000-8000-000000000099")] });
    expect(await getKqPlayerRunsSnapshot(owner, { runId: ids[1] })).toEqual({ activeRun: null, activeRuns: [] });
    expect(rpc.reads.filter(read => read.table === "kq_runs").every(read =>
      read.filters.some(([key, value]) => key === "user_id" && value === owner))).toBe(true);
  });
  it("reopens the leader when a completed member is requested, without leaking another owner", async () => {
    database({ runs: [row(0, game(), "completed"), row(1, game(), "completed")] });
    expect((await getKqPlayerRunsSnapshot(owner, { runId: ids[1] })).activeRun?.runId).toBe(ids[0]);
    expect((await getKqPlayerRunsSnapshot("11000000-0000-4000-8000-000000000099", { runId: ids[1] })).activeRun).toBeNull();
  });
  it("commits one roll and all projections together, with identical dice and care", async () => {
    const rpc = database({ runs: [row(0), row(1)] });
    const result = await applyKqPlayerRunAction(owner, ids[0], "roll");
    const args = rpc.mock.calls[0][1];
    expect(rpc.mock.calls[0][0]).toBe("rpc_kq_update_campaign_state");
    expect(args.p_members).toHaveLength(2);
    for (const member of args.p_members) {
      expect(member.state.dice).toEqual(result.state.dice);
      expect(member.state.care).toEqual(result.state.care);
      expect(member.flower).toBeNull();
    }
  });
  it("refuses a direct member action before any mutation", async () => {
    const rpc = database({ runs: [row(0), row(1)] });
    await expect(applyKqPlayerRunAction(owner, ids[1], "roll")).rejects.toThrow("campagne commune");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("finalizes distinct harvests and flower profiles in one transaction", async () => {
    const state = readyToHarvest();
    expect(state.phase).toBe("resolved");
    const rpc = database({ runs: [row(0, state), row(1, state)] });
    const result = await applyKqPlayerRunAction(owner, ids[0], "advance");
    const args = rpc.mock.calls[0][1];
    expect(result.persistedFlowers).toHaveLength(2);
    expect(args.p_members[0].state.harvestGrams).not.toBe(args.p_members[1].state.harvestGrams);
    expect(args.p_members[0].flower.cannabinoidReport.totals).not.toEqual(args.p_members[1].flower.cannabinoidReport.totals);
    expect(args.p_members[0].flower.terpeneReport.totalPercent).not.toBe(args.p_members[1].flower.terpeneReport.totalPercent);
    for (const member of args.p_members) expect(parseKqGameSave(encodeKqSave(member.state))).toEqual(member.state);
  });
  it("returns existing harvest receipts after a lost final response without a second mutation", async () => {
    const state = advanceKqStage(readyToHarvest());
    const flowers = ids.map((run_id, index) => ({ id: `flower-${index}`, run_id, owner_id: owner, status: "available", created_at: "now" }));
    const rpc = database({ runs: [row(0, state, "completed"), row(1, state, "completed")], flowers });
    const result = await applyKqPlayerRunAction(owner, ids[0], "advance");
    expect(result).toMatchObject({ replayed: true, state: parseKqGameSave(encodeKqSave(state)), persistedFlower: { id: "flower-0" } });
    expect(result.persistedFlowers?.map(flower => flower.zoneId)).toEqual(["a", "b"]);
    expect(rpc).not.toHaveBeenCalled();
  });
});
