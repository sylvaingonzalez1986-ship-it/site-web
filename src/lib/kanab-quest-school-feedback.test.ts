import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseKqSchoolCheck } from "./kanab-quest-school-feedback";
import { getKqSchoolQuiz, gradeKqSchoolQuestion, gradeKqSchoolSubmission } from "./kanab-quest-school-server";
import { getKqSchoolAnswer } from "./kanab-quest-school-answers";
import { KQ_SCHOOL_QUIZ_IDS } from "./kanab-quest-school";
const owner = "12345678-1234-4123-8123-123456789abc", other = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
beforeEach(() => vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-feedback-test-secret"));
afterEach(() => vi.unstubAllEnvs());
function command(quizId = "plant") {
  const quiz = getKqSchoolQuiz(quizId, owner), question = quiz.questions[0];
  return { requestKey: owner, quizId: quiz.quizId, contentVersion: quiz.contentVersion, selectionId: quiz.selectionId!, questionId: question.id, optionId: getKqSchoolAnswer(question.id)!.correctOptionId };
}
describe("signed immediate school feedback", () => {
  it.each(KQ_SCHOOL_QUIZ_IDS)("checks only the selected %s question, for its owner", quizId => {
    const input = command(quizId), parsed = parseKqSchoolCheck(input)!;
    expect(parsed).toEqual(input);
    const correction = gradeKqSchoolQuestion(parsed, owner);
    expect(correction.isCorrect).toBe(true); expect(correction.questionId).toBe(input.questionId);
    expect(correction.explanation).toBeTruthy(); expect(correction).not.toHaveProperty("gainCents");
    expect(() => gradeKqSchoolQuestion(parsed, other)).toThrow();
    expect(() => gradeKqSchoolQuestion({ ...parsed, contentVersion: "obsolete" }, owner)).toThrow();
  });
  it.each(KQ_SCHOOL_QUIZ_IDS)("cannot strip the %s signature for a newly paid attempt", quizId => {
    const quiz = getKqSchoolQuiz(quizId, owner);
    const value = { requestKey: owner, quizId, contentVersion: quiz.contentVersion, answers: quiz.questions.map(question => ({ questionId: question.id, optionId: getKqSchoolAnswer(question.id)!.correctOptionId })) };
    expect(gradeKqSchoolSubmission(value, owner)).toBeNull();
  });
  it("gives law retakes distinct signed identities despite the same questions", () => {
    const first = getKqSchoolQuiz("law", owner), second = getKqSchoolQuiz("law", owner);
    expect(first.selectionId).not.toBe(second.selectionId);
    expect(first.questions.map(q => q.id)).toEqual(second.questions.map(q => q.id));
  });
  it("rejects unsigned, cross-course, unselected and invented answers", () => {
    const input = command();
    expect(parseKqSchoolCheck({ ...input, selectionId: undefined })).toBeNull();
    expect(parseKqSchoolCheck({ ...input, quizId: "law" })).toBeNull();
    expect(() => gradeKqSchoolQuestion({ ...input, questionId: "law-q01" }, owner)).toThrow();
    expect(() => gradeKqSchoolQuestion({ ...input, optionId: "invented" }, owner)).toThrow();
    const changed = input.selectionId.slice(0, -1) + (input.selectionId.endsWith("a") ? "b" : "a");
    expect(() => gradeKqSchoolQuestion({ ...input, selectionId: changed }, owner)).toThrow();
  });
  it.each(["score", "gainCents", "ownerId", "correctOptionId"])("accepts no injected %s field", field => {
    expect(parseKqSchoolCheck({ ...command(), [field]: 10 })).toBeNull();
  });
});
