import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn(), equipment: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: mocks.client }));
vi.mock("@/lib/supabase/kanab-quest-equipment-backend", () => ({ getKqEquipmentShopSnapshot: mocks.equipment }));
import { getKqRecentSituationCodes, startKqPlayerRun } from "./kanab-quest-backend";
import { buildKqScenarioPath, KQ_BUDDIES, KQ_STAGES } from "../kanab-quest-game";

const userId = "11000000-0000-4000-8000-000000000001";
function database(history: unknown[], error: { message: string } | null = null) {
  const historyCalls: Array<[string, ...unknown[]]> = [];
  const rpc = vi.fn().mockImplementation((name: string) => Promise.resolve({ error: null, data: name === "rpc_kq_commerce_state"
    ? { business: { version: 1, domiciliation: { mode: "home", active: true } } }
    : { run: { id: "new-run" }, burnReceipt: null } }));
  mocks.equipment.mockResolvedValue({ strength: "green-thumb", equippedCodes: [], levels: {} });
  mocks.client.mockReturnValue({ rpc, from: (table: string) => {
    const data = table === "kq_runs" ? history : table === "lottery_card_collections" ? { id: "botte", is_active: true }
      : table === "kq_culture_token_wallets" ? { balance: 0 } : [];
    const query = {
      select: (...args: unknown[]) => call("select", args), eq: (...args: unknown[]) => call("eq", args),
      in: (...args: unknown[]) => call("in", args), order: (...args: unknown[]) => call("order", args),
      limit: (...args: unknown[]) => call("limit", args), maybeSingle: () => query,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: table === "kq_runs" ? error : null }).then(resolve),
    };
    function call(method: string, args: unknown[]) { if (table === "kq_runs") historyCalls.push([method, ...args]); return query; }
    return query;
  } });
  return { rpc, historyCalls };
}

describe("server culture scenario history", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it("reads a bounded, owner-scoped history in a stable newest-first order", async () => {
    const recent = buildKqScenarioPath(42), older = buildKqScenarioPath(84, recent);
    const { historyCalls } = database([
      { scenario_codes: recent, status: "completed", state: {} },
      { scenario_codes: older, status: "completed", state: {} },
    ]);
    expect(await getKqRecentSituationCodes(userId)).toEqual([...recent, ...older]);
    expect(historyCalls).toEqual([
      ["select", "scenario_codes,status,state"], ["eq", "user_id", userId], ["in", "status", ["completed", "abandoned"]],
      ["order", "started_at", { ascending: false }], ["order", "id", { ascending: false }], ["limit", 12],
    ]);
  });

  it("counts reached abandoned stages and ignores unknown or malformed history", async () => {
    const path = buildKqScenarioPath(42);
    database([
      { scenario_codes: path, status: "abandoned", state: { stageIndex: 1 } },
      { scenario_codes: ["SIT-999", path[2], null], status: "completed", state: {} },
      { scenario_codes: path, status: "abandoned", state: {} },
      { scenario_codes: "bad", status: "completed", state: {} },
    ]);
    expect(await getKqRecentSituationCodes(userId)).toEqual([...path.slice(0, 2), path[2]]);
  });

  it("uses this history when preparing the authoritative start RPC", async () => {
    const previous = buildKqScenarioPath(42, [], [], [], "home");
    const { rpc } = database([{ scenario_codes: previous, status: "completed", state: {} }]);
    vi.stubGlobal("crypto", { getRandomValues: (array: Uint32Array) => { array[0] = 42; return array; } });
    const result = await startKqPlayerRun(userId, { buddieCode: KQ_BUDDIES[0].code, deckCodes: [] });
    expect(result.state.situationCodes).toEqual(buildKqScenarioPath(42, previous, [], [], "home"));
    expect(result.state.situationCodes.every((code, stage) => KQ_STAGES[stage] === "Récolte" || code !== previous[stage])).toBe(true);
    expect(rpc).toHaveBeenCalledWith("rpc_kq_start_run_with_heritage", expect.objectContaining({
      p_user_id: userId, p_scenario_codes: result.state.situationCodes,
      p_initial_state: expect.objectContaining({ situationCodes: result.state.situationCodes }),
    }));
  });

  it("does not silently start without history when the read fails", async () => {
    const { rpc } = database([], { message: "history unavailable" });
    await expect(startKqPlayerRun(userId, { buddieCode: KQ_BUDDIES[0].code, deckCodes: [] })).rejects.toThrow("scenario-history");
    expect(rpc.mock.calls.some(([name]) => name === "rpc_kq_start_run_with_heritage")).toBe(false);
  });

  it("rejects invalid owners before reading history", async () => {
    await expect(getKqRecentSituationCodes("someone-else")).rejects.toThrow("Compte Placard invalide");
    expect(mocks.client).not.toHaveBeenCalled();
  });
});