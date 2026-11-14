import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("./admin", () => ({ createSupabaseServiceClient: () => ({ rpc }) }));
import { checkKqSchoolQuestion } from "./kanab-quest-school-feedback-backend";
import { getKqSchoolQuiz } from "../kanab-quest-school-server";
const owner = "12345678-1234-4123-8123-123456789abc";
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-feedback-test-key"); });
afterEach(() => vi.unstubAllEnvs());
function command() { const quiz = getKqSchoolQuiz("plant", owner), question = quiz.questions[0]; return { requestKey: owner, quizId: quiz.quizId, contentVersion: quiz.contentVersion, selectionId: quiz.selectionId!, questionId: question.id, optionId: question.options[0].id }; }
describe("persist first answer before disclosing its correction", () => {
  it("calls only the private feedback RPC with server grading and returns its persisted replay", async () => {
    rpc.mockImplementation(async (_name, args) => ({ data: { correction: { ...args.p_correction, explanation: "Persisted explanation" }, replayed: true }, error: null }));
    const value = command(), result = await checkKqSchoolQuestion(owner, value);
    expect(rpc.mock.calls[0][0]).toBe("rpc_kq_school_check"); expect(rpc.mock.calls[0][1].p_command).toEqual(value);
    expect(rpc.mock.calls[0][1].p_correction.correctOptionId).toBeTruthy(); expect(result.correction.explanation).toBe("Persisted explanation");
    expect(result.ownerId).toBe(owner); expect(result.replayed).toBe(true); expect(result).not.toHaveProperty("gainCents");
  });
  it("never returns the computed correction when persistence fails or the answer was changed", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "school_feedback_locked" } });
    await expect(checkKqSchoolQuestion(owner, command())).rejects.toMatchObject({ status: 409, code: "school_feedback_locked" });
    rpc.mockResolvedValue({ data: null, error: { message: "private SQL credentials" } });
    await expect(checkKqSchoolQuestion(owner, command())).rejects.toThrow("[school] feedback storage unavailable");
  });
  it("rejects a forged signature before storage", async () => {
    await expect(checkKqSchoolQuestion(owner, { ...command(), selectionId: "b1." + owner + "." + "0".repeat(64) })).rejects.toMatchObject({ code: "CONTENT_VERSION_CHANGED" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
