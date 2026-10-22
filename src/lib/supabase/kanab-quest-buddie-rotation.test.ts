import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn(), equipment: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: mocks.client }));
vi.mock("@/lib/supabase/kanab-quest-equipment-backend", () => ({ getKqEquipmentShopSnapshot: mocks.equipment }));
vi.mock("./kanab-quest-warehouse-backend", () => ({ getKqWarehouseRunSnapshot: vi.fn().mockResolvedValue(null) }));
import { getKqPlayerBuddieRotation, startKqPlayerRun } from "./kanab-quest-backend";
import { buildKqScenarioPath, KQ_BUDDIES, resolveKqStage, rollKqDice } from "../kanab-quest-game";
import { encodeKqSave, parseKqGameSave } from "../kanab-quest-persistence";

const ownerId = "11000000-0000-4000-8000-000000000001";
const code = KQ_BUDDIES[0].code;
const startInput = { buddieCode: code, deckCodes: [] };
function database(options: {
  recent?: unknown;
  missing?: boolean;
  rotationError?: { message: string };
  startError?: { message: string; details?: string };
  domiciliation?: { mode: string; active: boolean; retired?: unknown };
} = {}) {
  const reads: Array<[string, ...unknown[]]> = [];
  const rpc = vi.fn().mockImplementation((name: string, args?: { p_initial_state?: unknown }) => Promise.resolve(name === "rpc_kq_reserved_cards" ? { data: [], error: null } : name === "rpc_kq_commerce_state"
    ? { error: null, data: { business: { version: 1, domiciliation: options.domiciliation ?? { mode: "home", active: true } } } }
    : { error: options.startError ?? null, data: { run: { id: "run-new", state: args?.p_initial_state }, burnReceipt: null } }));
  mocks.equipment.mockResolvedValue({
    strength: "green-thumb", equippedCodes: [], levels: {},
    tents: [{ tentNumber: 1, cultureOperationalCodes: [], levels: {} }],
    sharedEquipment: { equippedCodes: [], levels: {} },
  });
  mocks.client.mockReturnValue({ rpc, from: (table: string) => {
    const data = table === "kq_buddie_rotation" ? (options.missing ? null : { recent_buddie_codes: options.recent ?? [] })
      : table === "lottery_card_collections" ? { id: "botte", is_active: true }
      : table === "kq_culture_token_wallets" ? { balance: 0 } : [];
    const query = {
      select: (...args: unknown[]) => call("select", args), eq: (...args: unknown[]) => call("eq", args),
      in: (...args: unknown[]) => call("in", args), order: (...args: unknown[]) => call("order", args),
      limit: (...args: unknown[]) => call("limit", args), maybeSingle: () => call("maybeSingle", []),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: table === "kq_buddie_rotation" ? options.rotationError ?? null : null }).then(resolve),
    };
    function call(method: string, args: unknown[]) { if (table === "kq_buddie_rotation") reads.push([method, ...args]); return query; }
    return query;
  } });
  return { rpc, reads };
}

describe("persisted Buddie rotation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads the authenticated owner across all seasons", async () => {
    const { reads } = database({ recent: ["B", "A"] });
    expect(await getKqPlayerBuddieRotation(ownerId)).toEqual({ requiredDistinctBuddies: 2, recentBuddieCodes: ["B", "A"] });
    expect(reads).toEqual([["select", "recent_buddie_codes"], ["eq", "user_id", ownerId], ["maybeSingle"]]);
  });

  it("allows a new player with no rotation row", async () => {
    database({ missing: true });
    expect(await getKqPlayerBuddieRotation(ownerId)).toEqual({ requiredDistinctBuddies: 2, recentBuddieCodes: [] });
  });

  it("keeps only the two most recent distinct varieties from legacy history", async () => {
    database({ recent: ["C", "B", "B", code, "E", "F"] });
    expect(await getKqPlayerBuddieRotation(ownerId)).toEqual({ requiredDistinctBuddies: 2, recentBuddieCodes: ["C", "B"] });
  });

  it("refuses invalid owners before making a database query", async () => {
    await expect(getKqPlayerBuddieRotation("invalid")).rejects.toThrow("Compte Kanab Quest invalide");
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("refuses a locked Buddie before the start transaction", async () => {
    const { rpc } = database({ recent: ["B", code] });
    await expect(startKqPlayerRun(ownerId, startInput)).rejects.toThrow("1 autre Buddie différent");
    expect(rpc.mock.calls.some(([name]) => name === "rpc_kq_start_run_with_heritage")).toBe(false);
  });

  it("keeps the latest Buddie locked until two other varieties are used", async () => {
    const { rpc } = database({ recent: [code, "B"] });
    await expect(startKqPlayerRun(ownerId, startInput)).rejects.toThrow("2 autres Buddies différents");
    expect(rpc.mock.calls.some(([name]) => name === "rpc_kq_start_run_with_heritage")).toBe(false);
  });

  it("returns the updated rotation after a successful eligible start", async () => {
    const { rpc } = database({ recent: ["F", "E", code, "C", "B"] });
    expect(await startKqPlayerRun(ownerId, startInput)).toMatchObject({
      runId: "run-new", buddieRotation: { requiredDistinctBuddies: 2, recentBuddieCodes: [code, "F"] },
    });
    expect(rpc).toHaveBeenCalledWith("rpc_kq_start_run_with_heritage", expect.objectContaining({ p_user_id: ownerId, p_buddie_code: code }));
  });

  it.each([
    [{ mode: "home", active: false, retired: true }, "external"],
    [{ mode: "external", active: false, retired: true }, "external"],
    [{ mode: "home", active: false }, "home"],
    [{ mode: "external", active: true }, "external"],
    [{ mode: "external", active: false }, "home"],
    [{ mode: "home", active: false, retired: "true" }, "home"],
  ] as const)("uses only the server's confirmed address-retirement capability (%j)", async (domiciliation, expected) => {
    const { rpc } = database({ domiciliation });
    await startKqPlayerRun(ownerId, startInput);
    expect(rpc).toHaveBeenCalledWith("rpc_kq_start_run_with_heritage", expect.objectContaining({
      p_initial_state: expect.objectContaining({ domiciliation: expected }),
    }));
  });

  it("keeps retired-account runs in the legacy-readable normal-risk format through the next turn", async () => {
    database({ domiciliation: { mode: "home", active: false, retired: true } });
    const { state } = await startKqPlayerRun(ownerId, startInput);
    expect(state.domiciliation).toBe("external");
    expect(state.situationCodes).toEqual(buildKqScenarioPath(state.seed, [], [], [], "retired"));
    const restored = parseKqGameSave(encodeKqSave(state))!;
    expect(restored).toEqual(state);
    const next = resolveKqStage(rollKqDice(restored));
    expect(next.domiciliation).toBe("external");
    expect(next.situationCodes).toEqual(state.situationCodes);
    expect(parseKqGameSave(encodeKqSave(next))).toEqual(next);
  });

  it("requires a refreshed snapshot when retirement changes before the start transaction", async () => {
    database({ startError: { message: "kq_domiciliation_changed" } });
    await expect(startKqPlayerRun(ownerId, startInput)).rejects.toThrow("Les règles de cette culture ont changé. Actualise avant de la lancer.");
  });

  it("translates an atomic rejection when another tab has used the card since the read", async () => {
    database({ startError: { message: "kq_buddie_rotation_locked", details: JSON.stringify({ remainingDistinctBuddies: 1 }) } });
    await expect(startKqPlayerRun(ownerId, startInput)).rejects.toThrow("1 autre Buddie différent");
  });

  it("does not start when durable rotation cannot be verified", async () => {
    const { rpc } = database({ rotationError: { message: "relation unavailable" } });
    await expect(startKqPlayerRun(ownerId, startInput)).rejects.toThrow("[supabase:kq_buddie_rotation]");
    expect(rpc.mock.calls.some(([name]) => name === "rpc_kq_start_run_with_heritage")).toBe(false);
  });

  it("does not silently treat malformed history as an unlocked collection", async () => {
    const { rpc } = database({ recent: "bad history" });
    await expect(startKqPlayerRun(ownerId, startInput)).rejects.toThrow("Historique invalide");
    expect(rpc.mock.calls.some(([name]) => name === "rpc_kq_start_run_with_heritage")).toBe(false);
  });
});
