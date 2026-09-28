import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminMissionsOverviewFromSupabase, getCustomerMissionsFromSupabase, reviewMissionSubmissionInSupabase, submitMissionProofInSupabase, createSocialMissionInSupabase } from "@/lib/supabase/missions-backend";
import type { SocialMissionEditorInput } from "@/types/missions";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), getUser: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => ({ ...mocks, auth: { admin: { getUserById: mocks.getUser } } }) }));
vi.mock("@/lib/mission-proof-storage", () => ({ createMissionProofSignedUrl: vi.fn() }));
const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", mission = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", key = "cccccccc-cccc-4ccc-8ccc-cccccccccccc", submissionId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const row = { id: submissionId, user_id: user, mission_id: mission, revision: 2, status: "pending", reward_type_snapshot: "game_cash", reward_amount_snapshot: 15000, reward_card_id_snapshot: null, reward_card_name_snapshot: null, reward_label_snapshot: "150 € du jeu", mission_title_snapshot: "Promesse initiale", proof_storage_path: user + "/proof.webp", proof_file_size: null };
beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: { submission: row, replayed: false }, error: null }); });
describe("atomic community mission backend", () => {
  it("submits through the transaction and maps frozen reward and revision", async () => {
    const result = await submitMissionProofInSupabase({ userId: user, missionId: mission, requestKey: key, submissionId, expectedRevision: 1, proofText: " correction " });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_submit_social_mission", expect.objectContaining({ p_user_id: user, p_mission_id: mission, p_request_key: key, p_submission_id: submissionId, p_expected_revision: 1, p_proof_storage_path: null, p_proof_text: "correction" }));
    expect(result).toMatchObject({ revision: 2, rewardType: "game_cash", rewardAmount: 15000, missionTitle: "Promesse initiale", proofFileSize: null });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("reviews atomically instead of issuing independent balance or status writes", async () => {
    await reviewMissionSubmissionInSupabase({ submissionId, expectedRevision: 2, requestKey: key, action: "approve", adminEmail: "owner@example.test" });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_review_social_mission", { p_submission_id: submissionId, p_expected_revision: 2, p_request_key: key, p_decision: "approved", p_admin_email: "owner@example.test", p_admin_note: null });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("maps request_changes to the correction status with a required explanation", async () => {
    await reviewMissionSubmissionInSupabase({ submissionId, expectedRevision: 2, requestKey: key, action: "request_changes", adminEmail: "owner@example.test", adminNote: " Le pseudo manque. " });
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({ p_decision: "changes_requested", p_admin_note: "Le pseudo manque." });
  });
  it.each(["reject", "request_changes"] as const)("refuses %s without a review reason", async action => {
    await expect(reviewMissionSubmissionInSupabase({ submissionId, expectedRevision: 2, requestKey: key, action, adminEmail: "owner@example.test", adminNote: " " })).rejects.toMatchObject({ status: 400 });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["mission_stale_revision", "mission_completion_limit", "mission_request_key_reused", "mission_already_pending", "mission_reward_already_granted"])("identifies a certain rolled-back conflict: %s", async message => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "P0001", message } });
    await expect(submitMissionProofInSupabase({ userId: user, missionId: mission, requestKey: key })).rejects.toMatchObject({ status: 409, transactionRolledBack: true });
  });
  it("never infers rollback certainty from an untrusted transport error", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "mission_already_pending" } });
    await expect(submitMissionProofInSupabase({ userId: user, missionId: mission, requestKey: key })).rejects.toMatchObject({ transactionRolledBack: false });
  });
  it("hides unknown provider details and retains retry semantics", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42P01", message: "private SQL token detail" } });
    await expect(submitMissionProofInSupabase({ userId: user, missionId: mission, requestKey: key })).rejects.toMatchObject({ status: 503, transactionRolledBack: false });
  });
  it("rejects another player's private storage path before calling the database", async () => {
    await expect(submitMissionProofInSupabase({ userId: user, missionId: mission, requestKey: key, proofStoragePath: mission + "/proof.webp" })).rejects.toMatchObject({ status: 400 });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("preserves inactive missions with the user's history and allows requested corrections", async () => {
    const data = {
      social_missions: [
        { id: mission, is_active: false, reward_type: "buddies", reward_amount: 1, reward_card_id: key, reward_card: { name: "Capitaine Chanvre" }, max_completions_per_user: 1 },
        { id: key, is_active: false, reward_type: "points", reward_amount: 5 },
      ],
      social_mission_submissions: [{ ...row, status: "changes_requested" }],
    };
    mocks.from.mockImplementation((table: keyof typeof data) => {
      const builder = { select: () => builder, eq: () => builder, order: () => builder, then: (resolve: (value: unknown) => void) => resolve({ data: data[table], error: null }) };
      return builder;
    });
    const missions = await getCustomerMissionsFromSupabase(user);
    expect(missions).toHaveLength(1);
    expect(missions[0]).toMatchObject({ id: mission, canSubmit: true, isActive: false, rewardCardName: "Capitaine Chanvre" });
  });
  it.each([["game_cash", 100001], ["support_pack", 6], ["buddies", 2], ["points", 1.5], ["packs", -1]])("rejects invalid catalogue reward %s=%s before mutation", async (rewardType, rewardAmount) => {
    await expect(createSocialMissionInSupabase({ slug: "test", title: "test", description: "test", icon: "star", rewardType, rewardAmount, rewardCardId: key, maxCompletionsPerUser: 1, requiresProof: false, proofInstructions: null, isActive: true } as SocialMissionEditorInput)).rejects.toMatchObject({ status: 400 });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});

it("paginates every open dossier before the recent decision history", async () => {
  const open = Array.from({ length: 501 }, (_, index) => ({ ...row, id: "open-" + index, status: index === 500 ? "changes_requested" : "pending", review_version: index === 0 ? 0 : 1 }));
  const history = [{ ...row, id: "closed", status: "approved", reward_granted: true }];
  mocks.getUser.mockResolvedValue({ data: { user: { id: user, email: "player@example.test" } }, error: null });
  mocks.from.mockImplementation((table: string) => {
    const builder = {
      select: () => builder, in: () => builder, lte: () => builder, order: () => builder,
      range: (start: number, end: number) => Promise.resolve({ data: open.slice(start, end + 1), error: null }),
      limit: () => Promise.resolve({ data: history, error: null }),
      then: (resolve: (value: unknown) => void) => resolve({ data: table === "profiles" ? [{ id: user, first_name: "Camille", last_name: "" }] : [{ id: mission, title: "Current title" }], error: null }),
    };
    return builder;
  });
  const overview = await getAdminMissionsOverviewFromSupabase();
  expect(overview.submissions).toHaveLength(502);
  expect(overview.pendingSubmissions).toBe(500);
  expect(overview.changesRequestedSubmissions).toBe(1);
  expect(overview.submissions[0]).toMatchObject({ id: "open-0", legacyReview: true, userEmail: "player@example.test", missionTitle: "Promesse initiale" });
  expect(overview.submissions[500]).toMatchObject({ id: "open-500", status: "changes_requested" });
  expect(overview.submissions[501].id).toBe("closed");
});
