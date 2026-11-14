import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KQ_SCHOOL_MODULES } from "./kanab-quest-school-content";
import { KQ_SCHOOL_ANSWERS } from "./kanab-quest-school-answers";
import { getKqSchoolQuiz, gradeKqSchoolSubmission } from "./kanab-quest-school-server";
import { parseKqSchoolSubmission } from "./kanab-quest-school";

const owner = "12345678-1234-4123-8123-123456789abc";
beforeEach(() => vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-scoring-test-secret"));
afterEach(() => vi.unstubAllEnvs());
const firstQuizModule = () => KQ_SCHOOL_MODULES.find(item => item.id === "law")!;
function submission(score: number) {
  const quiz = firstQuizModule();
  const parsed = parseKqSchoolSubmission({ requestKey: "12345678-1234-4123-8123-123456789abc", quizId: quiz.id, contentVersion: quiz.version, selectionId: getKqSchoolQuiz("law", owner).selectionId,
    answers: quiz.questions.map((question, index) => ({ questionId: question.id, optionId: index < score
      ? KQ_SCHOOL_ANSWERS[question.id].correctOptionId
      : question.options.find(option => option.id !== KQ_SCHOOL_ANSWERS[question.id].correctOptionId)!.id })) });
  if (!parsed) throw new Error("Invalid test fixture");
  return parsed;
}
describe("server-only school scoring", () => {
  it("scores the real question bank from zero through ten without client amounts", () => {
    for (let score = 0; score <= 10; score++) {
      const grade = gradeKqSchoolSubmission(submission(score), owner);
      expect(grade?.score).toBe(score);
      expect(grade?.corrections).toHaveLength(10);
      expect(grade?.corrections.every(correction => correction.sources.length > 0 && correction.sectionId && correction.explanation)).toBe(true);
    }
  });
  it("requires the exact question and permitted option identifiers", () => {
    const invalidOption = submission(10); invalidOption.answers[0].optionId = "invented";
    expect(() => gradeKqSchoolSubmission(invalidOption, owner)).toThrow(/réponse/);
    const invalidQuestion = submission(10); invalidQuestion.answers[0].questionId = "other-quiz-q01";
    expect(() => gradeKqSchoolSubmission(invalidQuestion, owner)).toThrow(/question/);
  });
  it("does not grade an obsolete edition, allowing only receipt replay downstream", () => {
    expect(gradeKqSchoolSubmission({ ...submission(10), contentVersion: "old-edition" })).toBeNull();
  });
  it("returns only public questions and preserves option identities when shuffling", () => {
    for (const authored of KQ_SCHOOL_MODULES.filter(item => item.id !== "history" && item.id !== "plant" && item.id !== "molecules" && item.id !== "evidence" && item.id !== "genetics" && item.id !== "biodiversity" && item.id !== "uses" && item.id !== "profiles" && item.id !== "prevention")) {
      const quiz = getKqSchoolQuiz(authored.id);
      expect(quiz.contentVersion).toBe(authored.version);
      expect(quiz.questions).toHaveLength(10);
      for (const question of quiz.questions) {
        expect(question.options.map(option => option.id).sort()).toEqual(authored.questions.find(item => item.id === question.id)!.options.map(option => option.id).sort());
        expect(question).not.toHaveProperty("correctOptionId");
        expect(question).not.toHaveProperty("explanation");
      }
    }
    expect(() => getKqSchoolQuiz("invented")).toThrow();
  });
});
