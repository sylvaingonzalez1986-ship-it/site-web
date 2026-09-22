import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: mocks.client }));

import { applyKqPlayerRunAction } from "./kanab-quest-backend";
import { advanceKqStage, resolveKqStage, startKqGame, type KqGameState } from "../kanab-quest-game";

const userId = "11000000-0000-4000-8000-000000000001";
const runId = "11000000-0000-4000-8000-000000000002";
const updatedAt = "2026-09-22T10:00:00.000Z";

function database(state: KqGameState, status = "active") {
  const rpc = vi.fn().mockImplementation((_name: string, args: { p_next_state: KqGameState; p_flower: unknown }) => Promise.resolve({
    error: null,
    data: { state: args.p_next_state, flower: args.p_flower ? { id: "flower-1", status: "available", created_at: updatedAt } : null },
  }));
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: { state, status, updated_at: updatedAt }, error: null }),
  };
  mocks.client.mockReturnValue({ from: () => query, rpc });
  return rpc;
}

function afterStage(state: KqGameState, dice: [number, number, number]) {
  return resolveKqStage({ ...state, phase: "rolled", dice });
}

describe("server culture death persistence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persists the second zero-success stage immediately without a flower", async () => {
    const firstFailure = afterStage(startKqGame(42, { deckCodes: [] }), [1, 2, 3]);
    const state: KqGameState = { ...advanceKqStage(firstFailure), phase: "rolled", dice: [2, 2, 3] };
    const rpc = database(state);

    const result = await applyKqPlayerRunAction(userId, runId, "resolve");

    expect(result.state).toMatchObject({ phase: "complete", cultureDead: true, harvestGrams: 0, stageIndex: 1 });
    expect(result.state.history.map((stage) => stage.total)).toEqual([0, 0]);
    expect(result.persistedFlower).toBeNull();
    expect(rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_update_run_state", {
      p_user_id: userId,
      p_run_id: runId,
      p_expected_updated_at: updatedAt,
      p_action: "resolve",
      p_next_state: result.state,
      p_flower: null,
    });
  });

  it("also ends a culture when its zero-success stages are separated by a success", async () => {
    const firstFailure = afterStage(startKqGame(42, { deckCodes: [] }), [1, 2, 3]);
    const successfulStage = afterStage(advanceKqStage(firstFailure), [4, 4, 4]);
    const state: KqGameState = { ...advanceKqStage(successfulStage), phase: "rolled", dice: [2, 2, 3] };
    database(state);

    const result = await applyKqPlayerRunAction(userId, runId, "resolve");

    expect(result.state).toMatchObject({ phase: "complete", cultureDead: true, harvestGrams: 0, stageIndex: 2 });
    expect(result.state.history.map((stage) => stage.total)).toEqual([0, 3, 0]);
    expect(result.persistedFlower).toBeNull();
  });

  it("does not persist or award a second terminal result when a dead culture is replayed", async () => {
    const firstFailure = afterStage(startKqGame(42, { deckCodes: [] }), [1, 2, 3]);
    const dead = afterStage(advanceKqStage(firstFailure), [2, 2, 3]);
    const rpc = database(dead, "abandoned");

    await expect(applyKqPlayerRunAction(userId, runId, "resolve")).rejects.toThrow("Culture active introuvable");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("still persists a flower after a surviving culture completes all stages", async () => {
    let state = startKqGame(42, { deckCodes: [] });
    for (let stage = 0; stage < 6; stage += 1) {
      state = afterStage(state, stage === 0 ? [1, 2, 3] : [4, 4, 4]);
      if (stage < 5) state = advanceKqStage(state);
    }
    const rpc = database(state);

    const result = await applyKqPlayerRunAction(userId, runId, "advance");

    expect(result.state.phase).toBe("complete");
    expect(result.state.cultureDead).not.toBe(true);
    expect(result.state.harvestGrams).toBeGreaterThan(0);
    expect(result.persistedFlower).toMatchObject({ id: "flower-1", status: "available" });
    expect(rpc).toHaveBeenCalledWith("rpc_kq_update_run_state", expect.objectContaining({
      p_flower: expect.objectContaining({ varietyCode: state.varietyCode }),
    }));
  });
});
