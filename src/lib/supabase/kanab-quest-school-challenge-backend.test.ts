import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("./admin", () => ({ createSupabaseServiceClient: () => ({ rpc }) }));
import { getKqSchoolChallenge } from "./kanab-quest-school-challenge-backend";
import type { KqSchoolChallengeCommand } from "../kanab-quest-school-challenge";
const owner = "12345678-1234-4123-8123-123456789abc";
const snapshot = { version: 1, ownerId: owner, serverNow: "2026-11-12T12:00:00Z", bestScore: 0, bestCorrectCount: 0, completedCount: 0, round: null, replayed: false };
beforeEach(() => { vi.clearAllMocks(); rpc.mockResolvedValue({ data: snapshot, error: null }); });
describe("challenge privileged storage boundary", () => {
  it("reads only through the named RPC", async () => {
    expect(await getKqSchoolChallenge(owner)).toEqual(snapshot);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_school_challenge", { p_user_id: owner, p_command: null, p_plan: null });
  });
  it("creates a private plan only for start, never sends it back to the player", async () => {
    const result = await getKqSchoolChallenge(owner, { action: "start", requestKey: owner });
    expect(rpc.mock.calls[0][1].p_plan.questions).toHaveLength(20);
    expect(rpc.mock.calls[0][1].p_plan.questions[0].answer.correctOptionId).toBeTruthy(); expect(result).not.toHaveProperty("plan");
  });
  it("never accepts timing or grade from the client", async () => {
    await expect(getKqSchoolChallenge(owner, { action: "start", requestKey: owner, score: 3000 } as KqSchoolChallengeCommand)).rejects.toMatchObject({ status: 400 });
    expect(rpc).not.toHaveBeenCalled();
    await getKqSchoolChallenge(owner, { action: "answer", requestKey: owner, roundId: owner, questionId: "test-q01", optionId: "a" });
    expect(rpc.mock.calls[0][1].p_plan).toBeNull(); expect(rpc.mock.calls[0][1].p_command).not.toHaveProperty("elapsedMs");
  });
  it("reports immutable-answer conflicts without leaking internal errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "school_challenge_answer_locked" } });
    await expect(getKqSchoolChallenge(owner)).rejects.toMatchObject({ status: 409, code: "school_challenge_answer_locked" });
    rpc.mockResolvedValue({ data: null, error: { message: "private database context" } });
    await expect(getKqSchoolChallenge(owner)).rejects.toThrow("[challenge] storage unavailable");
  });
  it("rejects malformed or cross-owner storage snapshots", async () => {
    rpc.mockResolvedValue({ data: { ...snapshot, ownerId: "other" }, error: null });
    await expect(getKqSchoolChallenge(owner)).rejects.toThrow("[challenge] invalid snapshot");
  });
});
