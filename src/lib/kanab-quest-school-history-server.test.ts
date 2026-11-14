import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HISTORY_QUESTIONS, HISTORY_CHAPTERS, VERSION } from "./kanab-quest-school-history";
import { KQ_SCHOOL_ANSWERS, getKqSchoolAnswer } from "./kanab-quest-school-answers";
import { getKqSchoolQuiz, gradeKqSchoolSubmission } from "./kanab-quest-school-server";
import { selectKqSchoolHistoryQuestions } from "./kanab-quest-school-history-selection";
import { parseKqSchoolSubmission, type KqSchoolQuiz, type KqSchoolSubmission } from "./kanab-quest-school";
import { KQ_SCHOOL_HISTORY_LESSON_IDS, KQ_SCHOOL_HISTORY_CHECKPOINT_IDS, KQ_SCHOOL_HISTORY_ACTIVITY_IDS } from "./kanab-quest-school-history-progress";

const owner = "12345678-1234-4123-8123-123456789abc", other = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
beforeEach(() => vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-school-signature-test-secret-not-a-real-key"));
afterEach(() => vi.unstubAllEnvs());
function submission(quiz: KqSchoolQuiz, score = 10): KqSchoolSubmission {
  const parsed = parseKqSchoolSubmission({ requestKey: owner, quizId: "history", contentVersion: quiz.contentVersion, selectionId: quiz.selectionId,
    answers: quiz.questions.map((question, index) => ({ questionId: question.id, optionId: index < score ? getKqSchoolAnswer(question.id)!.correctOptionId
      : question.options.find(option => option.id !== getKqSchoolAnswer(question.id)!.correctOptionId)!.id })) });
  if (!parsed) throw new Error("Invalid history test submission");
  return parsed;
}
describe("signed history synthesis", () => {
  it("preserves the original 100 answer keys separately from all 44 detailed history keys", () => {
    expect(Object.keys(KQ_SCHOOL_ANSWERS)).toHaveLength(100);
    expect(HISTORY_QUESTIONS).toHaveLength(44);
    for (const question of HISTORY_QUESTIONS) {
      const answer = getKqSchoolAnswer(question.id)!;
      expect(question.options.some(option => option.id === answer.correctOptionId)).toBe(true);
      expect(Object.keys(answer.optionExplanations ?? {}).sort()).toEqual(question.options.map(option => option.id).sort());
      expect(Object.values(answer.optionExplanations ?? {}).every(text => text.length > 15)).toBe(true);
    }
  });
  it("keeps progress IDs synchronized with actual authored lessons and activities", () => {
    expect(HISTORY_CHAPTERS.flatMap(chapter => chapter.lessons.map(lesson => lesson.id)).sort()).toEqual([...KQ_SCHOOL_HISTORY_LESSON_IDS].sort());
    expect(HISTORY_CHAPTERS.map(chapter => chapter.checkpoint.id).sort()).toEqual([...KQ_SCHOOL_HISTORY_CHECKPOINT_IDS].sort());
    expect(HISTORY_CHAPTERS.flatMap(chapter => chapter.lessons.map(lesson => lesson.activity.id)).sort()).toEqual([...KQ_SCHOOL_HISTORY_ACTIVITY_IDS].sort());
  });
  it("selects ten distinct chapters and reconstructs the same exact question plan for retries", () => {
    const plans = new Set<string>();
    for (let index = 0; index < 20; index++) {
      const quiz = getKqSchoolQuiz("history", owner);
      expect(quiz.contentVersion).toBe(VERSION); expect(quiz.questions).toHaveLength(10);
      const plan = selectKqSchoolHistoryQuestions(owner, quiz.selectionId)!;
      expect(new Set(plan.map(question => question.chapterId)).size).toBe(10);
      expect(plan.map(question => question.id)).toEqual(quiz.questions.map(question => question.id));
      expect(selectKqSchoolHistoryQuestions(owner, quiz.selectionId)).toEqual(plan);
      plans.add(plan.map(question => question.id).join(","));
      expect(JSON.stringify(quiz)).not.toContain("correctOptionId");
      expect(JSON.stringify(quiz)).not.toContain("optionExplanations");
    }
    expect(plans.size).toBeGreaterThan(1);
  });
  it("grades zero through ten against reference answers and returns all distractor explanations", () => {
    const quiz = getKqSchoolQuiz("history", owner);
    for (let score = 0; score <= 10; score++) {
      const graded = gradeKqSchoolSubmission(submission(quiz, score), owner)!;
      expect(graded.score).toBe(score); expect(graded.corrections).toHaveLength(10);
      expect(graded.corrections.every(correction => Object.keys(correction.optionExplanations ?? {}).length === 4)).toBe(true);
    }
  });
  it("never grades another owner's selector, a forged selector, or a missing selector", () => {
    const quiz = getKqSchoolQuiz("history", owner), valid = submission(quiz);
    expect(gradeKqSchoolSubmission(valid, other)).toBeNull();
    const last = valid.selectionId!.slice(-1) === "a" ? "b" : "a";
    expect(gradeKqSchoolSubmission({ ...valid, selectionId: valid.selectionId!.slice(0, -1) + last }, owner)).toBeNull();
    expect(gradeKqSchoolSubmission({ ...valid, selectionId: undefined }, owner)).toBeNull();
  });
  it("rejects replacing a selected question or option even with a genuine signature", () => {
    const quiz = getKqSchoolQuiz("history", owner), value = submission(quiz);
    const unselected = HISTORY_QUESTIONS.find(question => !quiz.questions.some(selected => selected.id === question.id))!;
    const replacement = { ...value, answers: value.answers.map((answer, index) => index ? answer : { questionId: unselected.id, optionId: getKqSchoolAnswer(unselected.id)!.correctOptionId }) };
    expect(() => gradeKqSchoolSubmission(replacement, owner)).toThrow(/question/);
    value.answers[0].optionId = "invented";
    expect(() => gradeKqSchoolSubmission(value, owner)).toThrow(/réponse/);
  });
  it("uses old editions or rotated signing keys only for immutable receipt recovery", () => {
    const value = submission(getKqSchoolQuiz("history", owner));
    expect(gradeKqSchoolSubmission({ ...value, contentVersion: "2026-11-11.1" }, owner)).toBeNull();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "rotated-local-test-key");
    expect(gradeKqSchoolSubmission(value, owner)).toBeNull();
  });
});
