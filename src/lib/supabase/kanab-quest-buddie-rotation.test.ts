import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn(), equipment: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: mocks.client }));
vi.mock("@/lib/supabase/kanab-quest-equipment-backend", () => ({ getKqEquipmentShopSnapshot: mocks.equipment }));
import { getKqPlayerBuddieRotation, startKqPlayerRun } from "./kanab-quest-backend";
import { KQ_BUDDIES } from "../kanab-quest-game";

const ownerId = "11000000-0000-4000-8000-000000000001";
const code = KQ_BUDDIES[0].code;
const startInput = { buddieCode: code, deckCodes: [] };
function database(options: {
  recent?: unknown;
  missing?: boolean;
  rotationError?: { message: string };
  startError?: { message: string; details?: string };
} = {}) {
  const reads: Array<[string, ...unknown[]]> = [];
  const rpc = vi.fn().mockImplementation((name: string) => Promise.resolve(name === "rpc_kq_commerce_state"
    ? { error: null, data: { business: { version: 1, domiciliation: { mode: "home", active: true } } } }
    : { error: options.startError ?? null, data: { run: { id: "run-new" }, burnReceipt: null } }));
  mocks.equipment.mockResolvedValue({ strength: "green-thumb", equippedCodes: [], levels: {} });
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
    expect(await getKqPlayerBuddieRotation(ownerId)).toEqual({ requiredDistinctBuddies: 5, recentBuddieCodes: ["B", "A"] });
    expect(reads).toEqual([["select", "recent_buddie_codes"], ["eq", "user_id", ownerId], ["maybeSingle"]]);
  });

  it("allows a new player with no rotation row", async () => {
    database({ missing: true });
    expect(await getKqPlayerBuddieRotation(ownerId)).toEqual({ requiredDistinctBuddies: 5, recentBuddieCodes: [] });
  });

  it("refuses invalid owners before making a database query", async () => {
    await expect(getKqPlayerBuddieRotation("invalid")).rejects.toThrow("Compte Placard invalide");
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("refuses a locked Buddie before the start transaction", async () => {
    const { rpc } = database({ recent: ["B", code] });
    await expect(startKqPlayerRun(ownerId, startInput)).rejects.toThrow("4 autres Buddies différents");
    expect(rpc.mock.calls.some(([name]) => name === "rpc_kq_start_run_with_heritage")).toBe(false);
  });

  it("keeps the fifth preceding Buddie locked until another different one is used", async () => {
    const { rpc } = database({ recent: ["E", "D", "C", "B", code] });
    await expect(startKqPlayerRun(ownerId, startInput)).rejects.toThrow("1 autre Buddie différent");
    expect(rpc.mock.calls.some(([name]) => name === "rpc_kq_start_run_with_heritage")).toBe(false);
  });

  it("returns the updated rotation after a successful eligible start", async () => {
    const { rpc } = database({ recent: ["F", "E", "D", "C", "B"] });
    expect(await startKqPlayerRun(ownerId, startInput)).toMatchObject({
      runId: "run-new", buddieRotation: { requiredDistinctBuddies: 5, recentBuddieCodes: [code, "F", "E", "D", "C"] },
    });
    expect(rpc).toHaveBeenCalledWith("rpc_kq_start_run_with_heritage", expect.objectContaining({ p_user_id: ownerId, p_buddie_code: code }));
  });

  it("translates an atomic rejection when another tab has used the card since the read", async () => {
    database({ startError: { message: "kq_buddie_rotation_locked", details: JSON.stringify({ remainingDistinctBuddies: 3 }) } });
    await expect(startKqPlayerRun(ownerId, startInput)).rejects.toThrow("3 autres Buddies différents");
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
