import { beforeEach, describe, expect, it, vi } from "vitest";
import { changeKqContractBoard, getKqContractBoard } from "./kanab-quest-renewable-contracts-backend";
import { KqContractError } from "./kanab-quest-contracts-backend";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => ({ rpc: mocks.rpc }) }));
const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const attemptId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const runId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const otherAttemptId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const offers = [
  { code: "pure-grower", minimumQuality: 8, maxCardsUsed: 0, rewardCents: 1000 },
  { code: "steady-hand", minimumQuality: 10, maxCardsUsed: 2, rewardCents: 1500 },
  { code: "fine-flower", minimumQuality: 12, maxCardsUsed: null, rewardCents: 2000 },
];
const board = { version: 2, unlocked: true, canAccept: true, reason: null, offers, current: null, completedCount: 0 };
const accepted = { ...offers[0], id: attemptId, status: "accepted", runId: null, quality: null, cardsUsed: null, reason: null };
const receipt = { ...accepted, status: "claimed", runId, quality: 8, cardsUsed: 0, cashAfterCents: 101000 };
const claimResult = { board: { ...board, current: receipt, completedCount: 1 }, receipt, replayed: false };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ data: board, error: null });
});

describe("renewable contract server adapter", () => {
  it("scopes reads to the server's customer identity and validates the response", async () => {
    expect(await getKqContractBoard(user)).toEqual(board);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_contract_board", { p_user_id: user });
  });

  it("forwards only the stable attempt identity, action, and catalogue code", async () => {
    const result = { board: { ...board, canAccept: false, current: accepted }, receipt: null, replayed: false };
    mocks.rpc.mockResolvedValue({ data: result, error: null });
    const command = { action: "accept", code: "pure-grower", attemptId };
    expect(await changeKqContractBoard(user, command)).toEqual(result);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_contract_board_action", {
      p_user_id: user, p_action: "accept", p_code: "pure-grower", p_attempt_id: attemptId,
    });
  });

  it("forwards claim/cancel with no client-controlled reward or contract replacement", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: claimResult, error: null });
    await changeKqContractBoard(user, { action: "claim", attemptId });
    expect(mocks.rpc).toHaveBeenLastCalledWith("rpc_kq_contract_board_action", {
      p_user_id: user, p_action: "claim", p_code: null, p_attempt_id: attemptId,
    });
    mocks.rpc.mockResolvedValueOnce({ data: { board, receipt: null, replayed: false }, error: null });
    await changeKqContractBoard(user, { action: "cancel", attemptId });
    expect(mocks.rpc).toHaveBeenLastCalledWith("rpc_kq_contract_board_action", {
      p_user_id: user, p_action: "cancel", p_code: null, p_attempt_id: attemptId,
    });
  });

  it.each([
    { action: "claim", attemptId, userId: runId },
    { action: "claim", attemptId, rewardCents: 500000 },
    { action: "accept", attemptId, code: "light-hand" },
    { action: "claim", attemptId: "bad-id" },
  ])("rejects untrusted commands before contacting the database: %j", async command => {
    await expect(changeKqContractBoard(user, command)).rejects.toMatchObject({ status: 400 });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("retains a replay receipt without confusing it with a newer current contract", async () => {
    const result = {
      board: { ...board, canAccept: false, completedCount: 1, current: { ...accepted, id: otherAttemptId } },
      receipt, replayed: true,
    };
    mocks.rpc.mockResolvedValue({ data: result, error: null });
    expect(await changeKqContractBoard(user, { action: "claim", attemptId })).toEqual(result);
  });

  it("rejects the wrong claim receipt and unexpected payments on accept/cancel", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...claimResult, receipt: { ...receipt, id: otherAttemptId } }, error: null });
    await expect(changeKqContractBoard(user, { action: "claim", attemptId })).rejects.toMatchObject({ status: 503 });
    mocks.rpc.mockResolvedValue({ data: claimResult, error: null });
    await expect(changeKqContractBoard(user, { action: "cancel", attemptId })).rejects.toMatchObject({ status: 503 });
    await expect(changeKqContractBoard(user, { action: "accept", attemptId, code: "pure-grower" })).rejects.toMatchObject({ status: 503 });
  });

  it.each([null, {}, { ...board, completedCount: -1 }, { ...board, offers: offers.slice(1) }])("does not render malformed RPC data as available contracts: %j", async data => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(getKqContractBoard(user)).rejects.toMatchObject({ status: 503 });
  });

  it.each(["PGRST202", "42883"])("uses the legacy compatibility 404 only when the RPC is missing: %s", async code => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code, message: "function public.rpc_kq_contract_board(uuid) does not exist" } });
    await expect(getKqContractBoard(user)).rejects.toMatchObject({ status: 404 });
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code, message: "function public.rpc_kq_contract_board_action(uuid, text, text, uuid) does not exist" } });
    await expect(changeKqContractBoard(user, { action: "claim", attemptId })).rejects.toMatchObject({ status: 404 });
  });

  it("keeps a missing internal dependency visible instead of hiding the whole feature", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42883", message: "function public.private_accounting_helper(uuid) does not exist" } });
    await expect(getKqContractBoard(user)).rejects.toMatchObject({ status: 503 });
    await expect(changeKqContractBoard(user, { action: "claim", attemptId })).rejects.toMatchObject({ status: 503 });
  });

  it.each(["contract_locked", "contract_active_run", "contract_pending", "contract_already_started", "contract_not_ready", "contract_wallet_limit", "contract_attempt_conflict"])("maps a defined conflict without losing the existing attempt: %s", async message => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message } });
    await expect(changeKqContractBoard(user, { action: "claim", attemptId })).rejects.toMatchObject({ status: 409 });
  });

  it.each(["contract_unknown", "contract_action_invalid", "contract_attempt_invalid", "contract_attempt_unknown"])("maps invalid database commands to 400: %s", async message => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message } });
    await expect(changeKqContractBoard(user, { action: "claim", attemptId })).rejects.toMatchObject({ status: 400 });
  });

  it.each(["42501", "PGRST301", "XX000", undefined])("keeps backend outages visible and hides SQL details: %s", async code => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message: "private_relation and secret SQL details" } });
    try {
      await getKqContractBoard(user);
      expect.fail("backend must not look locked or available");
    } catch (error) {
      expect(error).toBeInstanceOf(KqContractError);
      expect(error).toMatchObject({ status: 503 });
      expect((error as Error).message).not.toContain("private_relation");
    }
  });
});
