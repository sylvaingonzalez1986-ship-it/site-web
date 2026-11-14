import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("./admin", () => ({ createSupabaseServiceClient: () => ({ rpc }) }));
import { getKqSchoolSnapshot, saveKqSchoolProgress, submitKqSchoolQuiz } from "./kanab-quest-school-backend";
import { KQ_SCHOOL_MODULES } from "../kanab-quest-school-content";
import { KQ_SCHOOL_ANSWERS } from "../kanab-quest-school-answers";
import { KQ_SCHOOL_QUIZ_IDS, parseKqSchoolSubmission, type KqSchoolSubmission } from "../kanab-quest-school";
import { getKqSchoolQuiz } from "../kanab-quest-school-server";
import { getKqSchoolAnswer } from "../kanab-quest-school-answers";

const owner = "12345678-1234-4123-8123-123456789abc";
const snapshot = () => ({ version: 1, ownerId: owner, cashCents: 100000, totalBudgetCents: 10000, totalPaidCents: 0,
  lessonIds: [], workshopIds: [], quizzes: KQ_SCHOOL_QUIZ_IDS.map(quizId => ({ quizId, rewardId: `school:${quizId}`, budgetCents: 1000, bestScore: null,
    paidCents: 0, remainingCents: 1000, attempts: 0, lastAttemptAt: null })) });
function submission() {
  const quiz = KQ_SCHOOL_MODULES.find(item => item.id === "law")!;
  return parseKqSchoolSubmission({ requestKey: owner, quizId: quiz.id, contentVersion: quiz.version, selectionId: getKqSchoolQuiz("law", owner).selectionId,
    answers: quiz.questions.map(question => ({ questionId: question.id, optionId: KQ_SCHOOL_ANSWERS[question.id].correctOptionId })) })!;
}
beforeEach(() => { vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-financial-test-secret"); vi.clearAllMocks(); rpc.mockResolvedValue({ error: null, data: snapshot() }); });
afterEach(() => vi.unstubAllEnvs());
describe("school server/storage boundary", () => {
  it("reads solely through the privileged school RPC", async () => {
    expect(await getKqSchoolSnapshot(owner)).toEqual(snapshot());
    expect(rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_school", { p_user_id: owner, p_command: null, p_grading: null });
  });
  it("calculates the score on the server and never passes a requested wallet amount", async () => {
    const value = submission();
    rpc.mockImplementation(async (_name, parameters) => ({ error: null,
      data: { snapshot: snapshot(), result: { score: parameters.p_grading.score, gainCents: 1000, corrections: parameters.p_grading.corrections }, replayed: false } }));
    expect((await submitKqSchoolQuiz(owner, value)).result.score).toBe(10);
    const sent = rpc.mock.calls[0][1];
    expect(sent.p_user_id).toBe(owner); expect(sent.p_command).toEqual({ action: "submit", requestKey: value.requestKey, quizId: value.quizId, contentVersion: value.contentVersion, answers: value.answers });
    expect(sent.p_grading.score).toBe(10); expect(sent.p_grading.corrections).toHaveLength(10);
    expect(sent.p_command).not.toHaveProperty("gainCents"); expect(sent.p_grading).not.toHaveProperty("budgetCents");
  });
  it("rejects forged score, unknown options and duplicate answers before SQL", async () => {
    await expect(submitKqSchoolQuiz(owner, { ...submission(), score: 10 } as KqSchoolSubmission)).rejects.toMatchObject({ status: 400 });
    const unknown = submission(); unknown.answers[0].optionId = "invented";
    await expect(submitKqSchoolQuiz(owner, unknown)).rejects.toMatchObject({ status: 400 });
    const duplicate = submission(); duplicate.answers[1] = duplicate.answers[0];
    await expect(submitKqSchoolQuiz(owner, duplicate)).rejects.toMatchObject({ status: 400 });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("allows only immutable receipt replay for an old edition", async () => {
    const old = { ...submission(), contentVersion: "obsolete" };
    rpc.mockResolvedValue({ error: { message: "school_version" }, data: null });
    await expect(submitKqSchoolQuiz(owner, old)).rejects.toMatchObject({ status: 409, code: "CONTENT_VERSION_CHANGED" });
    expect(rpc.mock.calls[0][1].p_grading).toBeNull();
  });
  it("passes one validated progress batch without any grade", async () => {
    await saveKqSchoolProgress(owner, { lessonIds: ["plant"], workshopIds: ["crossword-plant"] });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_school", { p_user_id: owner, p_command: { action: "progress", lessonIds: ["plant"], workshopIds: ["crossword-plant"] }, p_grading: null });
  });
  it("recognizes conflicts and keeps internal grading/database failures private", async () => {
    rpc.mockResolvedValue({ error: { message: "school_request_mismatch" }, data: null });
    await expect(submitKqSchoolQuiz(owner, submission())).rejects.toMatchObject({ status: 409 });
    rpc.mockResolvedValue({ error: { message: "school_invalid_grade private SQL context" }, data: null });
    await expect(submitKqSchoolQuiz(owner, submission())).rejects.toThrow("[school] storage unavailable");
    rpc.mockResolvedValue({ error: null, data: { version: 1 } });
    await expect(getKqSchoolSnapshot(owner)).rejects.toThrow("[school] invalid snapshot");
  });
  it.each(["history", "plant", "molecules", "evidence", "genetics", "biodiversity", "uses", "profiles", "prevention", "law"])("validates the %s selector without changing the persisted financial command format", async quizId => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-school-signature-test-key");
    const quiz = getKqSchoolQuiz(quizId, owner);
    const value = parseKqSchoolSubmission({ requestKey: owner, quizId, contentVersion: quiz.contentVersion, selectionId: quiz.selectionId,
      answers: quiz.questions.map(question => ({ questionId: question.id, optionId: getKqSchoolAnswer(question.id)!.correctOptionId })) })!;
    rpc.mockImplementation(async (_name, parameters) => ({ error: null,
      data: { snapshot: snapshot(), result: { score: parameters.p_grading.score, gainCents: 200, corrections: parameters.p_grading.corrections }, replayed: false } }));
    const result = await submitKqSchoolQuiz(owner, value);
    expect(rpc.mock.calls[0][0]).toBe("rpc_kq_school_submit_checked");
    expect(rpc.mock.calls[0][1].p_selection_id).toBe(quiz.selectionId);
    expect(result.result.score).toBe(10); expect(rpc.mock.calls[0][1].p_command).not.toHaveProperty("selectionId");
    expect(rpc.mock.calls[0][1].p_command.answers).toEqual(value.answers);
    rpc.mockResolvedValue({ error: null, data: { ...result, replayed: true } });
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "rotated-local-school-signature-test-key");
    expect((await submitKqSchoolQuiz(owner, value)).replayed).toBe(true);
    expect(rpc.mock.calls[1][1].p_grading).toBeNull();
    expect(rpc.mock.calls[1][1].p_command).toEqual(rpc.mock.calls[0][1].p_command);
  });
});
