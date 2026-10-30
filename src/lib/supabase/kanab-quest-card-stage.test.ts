import { beforeEach, describe, expect, it, vi } from "vitest";
import { advanceKqStage, KQ_STAGES, resolveKqStage, startKqGame } from "@/lib/kanab-quest-game";

const database = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), maybeSingle: vi.fn(), listUsers: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => ({
  from: database.from, rpc: database.rpc, auth: { admin: { listUsers: database.listUsers } },
}) }));

import { playKqAdminCard, playKqPlayerCard } from "@/lib/supabase/kanab-quest-backend";

const ownerId = "00000000-0000-4000-8000-000000000001";
const runId = "00000000-0000-4000-8000-000000000002";
const updatedAt = "2026-10-30T10:00:00.123456+00:00";
const cardCode = "BOTTE-017";
const initial = () => startKqGame(9, { deckCodes: [cardCode] });
const advanced = () => advanceKqStage(resolveKqStage({ ...initial(), phase: "rolled", dice: [6, 6, 6] }));

describe("card stage precondition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.from.mockReturnValue({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: database.maybeSingle });
    database.maybeSingle.mockResolvedValue({ data: { id: runId, user_id: ownerId, status: "active", state: initial(), updated_at: updatedAt }, error: null });
    database.rpc.mockImplementation(async (_name: string, args: { p_next_state: unknown; p_stage_index: number }) => ({
      data: { state: args.p_next_state, burnReceipt: { id: "receipt", card_instance_id: "copy", card_code: cardCode,
        stage_index: args.p_stage_index, use_kind: "support", burned_at: updatedAt } }, error: null,
    }));
    database.listUsers.mockResolvedValue({ data: { users: [{ id: ownerId, email: "stage-admin@example.test" }] }, error: null });
  });

  it("accepts stage zero and preserves the atomic update version and owner", async () => {
    const result = await playKqPlayerCard(ownerId, runId, cardCode, { expectedStageIndex: 0 });
    expect(result.state.usedCards).toEqual([cardCode]);
    expect(database.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_play_support_card", expect.objectContaining({
      p_user_id: ownerId, p_run_id: runId, p_card_code: cardCode, p_stage_index: 0, p_expected_updated_at: updatedAt,
    }));
  });

  it("preserves existing calls without a browser stage", async () => {
    expect((await playKqPlayerCard(ownerId, runId, cardCode)).state.usedCards).toEqual([cardCode]);
    expect(database.rpc).toHaveBeenCalledTimes(1);
  });

  it("rejects a delayed request after advancing, even when the card would still be playable", async () => {
    database.maybeSingle.mockResolvedValue({ data: { status: "active", state: advanced(), updated_at: updatedAt }, error: null });
    await expect(playKqPlayerCard(ownerId, runId, cardCode, { expectedStageIndex: 0 })).rejects.toThrow("La culture a changé d’étape");
    expect(database.rpc).not.toHaveBeenCalled();
  });

  it("checks the stage before card eligibility rather than reporting the later stage's card state", async () => {
    database.maybeSingle.mockResolvedValue({ data: { status: "active", state: { ...advanced(), handCodes: [] }, updated_at: updatedAt }, error: null });
    await expect(playKqPlayerCard(ownerId, runId, cardCode, { expectedStageIndex: 0 })).rejects.toThrow("La culture a changé d’étape");
    expect(database.rpc).not.toHaveBeenCalled();
  });

  it.each([null, "0", false, [], {}, -1, 0.5, KQ_STAGES.length, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Infinity])("rejects malformed stage %j before database access", async expectedStageIndex => {
    const options = { expectedStageIndex } as { expectedStageIndex: number };
    await expect(playKqPlayerCard(ownerId, runId, cardCode, options)).rejects.toThrow("Étape de carte invalide");
    await expect(playKqAdminCard("stage-admin@example.test", runId, cardCode, options)).rejects.toThrow("Étape de carte invalide");
    expect(database.from).not.toHaveBeenCalled();
    expect(database.listUsers).not.toHaveBeenCalled();
    expect(database.rpc).not.toHaveBeenCalled();
  });

  it("forwards the admin's stage precondition to the player operation", async () => {
    database.maybeSingle.mockResolvedValue({ data: { status: "active", state: advanced(), updated_at: updatedAt }, error: null });
    await expect(playKqAdminCard("stage-admin@example.test", runId, cardCode, { expectedStageIndex: 0 })).rejects.toThrow("La culture a changé d’étape");
    expect(database.rpc).not.toHaveBeenCalled();
  });

  it("still rejects a concurrent modification inside the existing atomic operation", async () => {
    database.rpc.mockResolvedValue({ error: { message: "kq_stale_run" }, data: null });
    await expect(playKqPlayerCard(ownerId, runId, cardCode, { expectedStageIndex: 0 })).rejects.toThrow("La culture a évolué");
    expect(database.rpc).toHaveBeenCalledTimes(1);
  });
});
