import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KqCultureWorkQuote } from "../kanab-quest-culture-work";
import { getKqPlayerWorkErrorMessage } from "../kanab-quest-player-work-errors";
import { startKqGame, type KqGameState } from "../kanab-quest-game";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), settle: vi.fn() }));
vi.mock("./admin", () => ({ createSupabaseServiceClient: () => ({ rpc: mocks.rpc, from: mocks.from }) }));
vi.mock("./kanab-quest-staff-backend", () => ({ settleKqStaffIfAvailable: mocks.settle }));
import { getKqCultureWorkQuote } from "./kanab-quest-culture-work-backend";
import { applyKqPlayerRunAction, applyKqRunAction } from "./kanab-quest-backend";

const owner = "11111111-1111-4111-8111-111111111111";
const runId = "22222222-2222-4222-8222-222222222222";
const updatedAt = "2026-11-08T10:00:00.000Z";
const quote = (): KqCultureWorkQuote => ({
  version: 1, runId, stageIndex: 0, day: 3, phase: "prepare", source: "employee", paid: false,
  stepHours: 0.5, playerRemainingHours: 12,
  employee: { id: "employee", name: "Anna", code: "anna", level: 3, role: "worker", taskId: "culture-shift", allocatedHours: 3, usedHours: 1, remainingHours: 2 },
  bonus: { vitality: 1, terpenes: 0, yieldPercent: 0, cannabinoids: 0 },
});
function stored(state: KqGameState = startKqGame(44)) {
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { state, status: "active", updated_at: updatedAt }, error: null }) };
  mocks.from.mockReturnValue(query);
  return query;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.settle.mockResolvedValue(undefined);
  stored();
  mocks.rpc.mockImplementation(async (name: string, args: { p_next_state: KqGameState }) => ({
    data: name === "rpc_kq_culture_work_quote" ? quote() : { state: args.p_next_state, flower: null }, error: null,
  }));
});

describe("authoritative culture work quote backend", () => {
  it("settles authorized weekly work before quoting and returns the validated SQL values", async () => {
    const expected = quote();
    expect(await getKqCultureWorkQuote(owner, runId)).toEqual(expected);
    expect(mocks.settle).toHaveBeenCalledExactlyOnceWith(owner);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_culture_work_quote", { p_user_id: owner, p_run_id: runId });
    expect(mocks.settle.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0]);
  });

  it.each([11.95, 11.55, .55, .49, .05])("returns the server quote with a %s h personal balance, including a legitimate blocked state", playerRemainingHours => {
    const expected = { ...quote(), playerRemainingHours, employee: null, source: playerRemainingHours < .5 ? "blocked" as const : "player" as const };
    mocks.rpc.mockResolvedValue({ data: expected, error: null });
    return expect(getKqCultureWorkQuote(owner, runId)).resolves.toEqual(expected);
  });

  it.each([["bad", runId], [owner, "bad"]])("rejects invalid identities before settlement or the RPC", async (userId, cultureId) => {
    await expect(getKqCultureWorkQuote(userId, cultureId)).rejects.toThrow("Culture invalide");
    expect(mocks.settle).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not quote hours when staff settlement failed", async () => {
    mocks.settle.mockRejectedValue(new Error("planning indisponible"));
    await expect(getKqCultureWorkQuote(owner, runId)).rejects.toThrow("planning indisponible");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each(["kq_run_not_found", "culture_work_run"])("maps %s without exposing database internals", async message => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message } });
    await expect(getKqCultureWorkQuote(owner, runId)).rejects.toThrow("Culture introuvable.");
  });

  it.each([null, {}, { ...quote(), stepHours: 1 }, { ...quote(), employee: null }, { ...quote(), playerRemainingHours: -1 }])("rejects malformed quote data %j", async data => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(getKqCultureWorkQuote(owner, runId)).rejects.toThrow("[supabase:culture-work] invalid_quote");
  });

  it("preserves expected business codes for the HTTP error mapping", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "culture_work_changed" } });
    await expect(getKqCultureWorkQuote(owner, runId)).rejects.toThrow("culture_work_changed");
  });
});

describe("atomic culture rolls through the server backend", () => {
  it("uses only automatic allocation through the dedicated RPC and stored run revision", async () => {
    const query = stored();
    const result = await applyKqPlayerRunAction(owner, runId, "roll", { expectedStageIndex: 0 });
    expect(mocks.settle).toHaveBeenCalledExactlyOnceWith(owner);
    expect(query.eq.mock.calls).toEqual([["id", runId], ["user_id", owner]]);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_roll_culture_step", {
      p_user_id: owner, p_run_id: runId, p_expected_updated_at: updatedAt,
      p_next_state: expect.objectContaining({ phase: "rolled", stageIndex: 0 }),
      p_work_choice: "auto", p_members: null,
    });
    expect(result.state.phase).toBe("rolled");
  });

  it("cannot force a player fallback through an unexpected option", async () => {
    const forgedOptions = { expectedStageIndex: 0, workChoice: "player" };
    await applyKqPlayerRunAction(owner, runId, "roll", forgedOptions);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_roll_culture_step", expect.objectContaining({ p_work_choice: "auto" }));
  });

  it.each(["rolled", "resolved"] as const)("replays an already %s stage without invoking a second debit", async phase => {
    const rolled = applyKqRunAction(startKqGame(44), "roll");
    const state = phase === "resolved" ? applyKqRunAction(rolled, "resolve") : rolled;
    stored(state);
    const result = await applyKqPlayerRunAction(owner, runId, "roll", { expectedStageIndex: 0 });
    expect(result).toMatchObject({ state: JSON.parse(JSON.stringify(state)), persistedFlower: null, replayed: true });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a stale confirmation before rolling or spending any hours", async () => {
    const state = applyKqRunAction(applyKqRunAction(applyKqRunAction(startKqGame(44), "roll"), "resolve"), "advance");
    expect(state.stageIndex).toBe(1);
    stored(state);
    await expect(applyKqPlayerRunAction(owner, runId, "roll", { expectedStageIndex: 0 })).rejects.toThrow("étape de culture a changé");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns SQL-enriched care, the paid receipt and its authoritative replay marker", async () => {
    const receipt: KqCultureWorkQuote = { ...quote(), phase: "rolled", paid: true };
    let persisted: KqGameState;
    mocks.rpc.mockImplementation(async (_name: string, args: { p_next_state: KqGameState }) => {
      persisted = { ...args.p_next_state, care: { ...args.p_next_state.care!, vitality: 99, terpenes: 80, yieldBonusPercent: 2, cannabinoidExpression: 75 } };
      return { data: { state: persisted, flower: null, cultureWork: receipt, replayed: true }, error: null };
    });
    const result = await applyKqPlayerRunAction(owner, runId, "roll");
    expect(result.state).toBe(persisted!);
    expect(result.state.care).toMatchObject({ vitality: 99, terpenes: 80, yieldBonusPercent: 2, cannabinoidExpression: 75 });
    expect(result).toMatchObject({ cultureWork: receipt, replayed: true });
    expect(mocks.rpc.mock.calls[0][1].p_next_state.care).not.toEqual(result.state.care);
  });

  it("omits malformed optional receipts without fabricating work or replay information", async () => {
    mocks.rpc.mockImplementation(async (_name: string, args: { p_next_state: KqGameState }) => ({ data: { state: args.p_next_state, cultureWork: { paid: true }, replayed: "true" }, error: null }));
    const result = await applyKqPlayerRunAction(owner, runId, "roll");
    expect(result).not.toHaveProperty("cultureWork");
    expect(result).not.toHaveProperty("replayed");
  });

  it.each([
    ["culture_work_exhausted", "réserve Culture"], ["culture_work_changed", "prise en charge"],
    ["player_work_exhausted", "12 h"], ["player_work_changed", "temps disponible"],
  ])("preserves the %s business error for the route", async (code, message) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: code } });
    const error = await applyKqPlayerRunAction(owner, runId, "roll").catch(error => error);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain(code);
    expect(getKqPlayerWorkErrorMessage(error)).toContain(message);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("does not silently replay a changed revision or accept an empty SQL result", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "kq_stale_run" } });
    await expect(applyKqPlayerRunAction(owner, runId, "roll")).rejects.toThrow("culture a évolué");
    mocks.rpc.mockResolvedValueOnce({ data: {}, error: null });
    await expect(applyKqPlayerRunAction(owner, runId, "roll")).rejects.toThrow("progression Supabase invalide");
  });
});
