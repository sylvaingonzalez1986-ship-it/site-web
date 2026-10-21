import { beforeEach, describe, expect, it, vi } from "vitest";
import { changeKqContract, getKqContract, KqContractError } from "./kanab-quest-contracts-backend";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => ({ rpc: mocks.rpc }) }));
const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const snapshot = { code: "light-hand", status: "available", runId: null, quality: null, cardsUsed: null,
  rewardCents: 3000, canAccept: true, reason: null };
beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: snapshot, error: null }); });

describe("contract server adapter", () => {
  it("uses only the authenticated identity and a strictly parsed server response", async () => {
    expect(await getKqContract(user)).toEqual(snapshot);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_contract_state", { p_user_id: user });
  });
  it("forwards accepted commands without client supplied state or money", async () => {
    await changeKqContract(user, { action: "accept", code: "light-hand" });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_contract_action", { p_user_id: user, p_code: "light-hand", p_action: "accept" });
    await expect(changeKqContract(user, { action: "claim", code: "light-hand", rewardCents: 999999 })).rejects.toMatchObject({ status: 400 });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("does not render successful progress from missing or altered RPC data", async () => {
    for (const data of [null, { ...snapshot, rewardCents: 9000 }, { ...snapshot, status: "claimed" }]) {
      mocks.rpc.mockResolvedValueOnce({ data, error: null });
      await expect(getKqContract(user)).rejects.toMatchObject({ status: 503 });
    }
  });
  it.each(["contract_active_run", "contract_already_started", "contract_not_ready", "contract_wallet_limit"])("maps an expected conflict to a player-readable response: %s", async code => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: code } });
    await expect(changeKqContract(user, { action: "claim", code: "light-hand" })).rejects.toMatchObject({ status: 409 });
  });
  it("hides SQL details when the migration or backend is unavailable", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "relation private_receipts does not exist" } });
    try { await getKqContract(user); expect.fail("must reject unavailable backend"); }
    catch (error) { expect(error).toBeInstanceOf(KqContractError); expect((error as Error).message).not.toContain("private_receipts"); }
  });
});
