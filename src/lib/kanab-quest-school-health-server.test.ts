import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HEALTH_QUESTIONS, HEALTH_CHAPTERS, VERSION } from "./kanab-quest-school-health";
import { KQ_SCHOOL_ANSWERS, getKqSchoolAnswer } from "./kanab-quest-school-answers";
import { getKqSchoolQuiz, gradeKqSchoolSubmission } from "./kanab-quest-school-server";
import { selectKqSchoolHealthQuestions } from "./kanab-quest-school-health-selection";
import { createKqSchoolHistorySelection, selectKqSchoolHistoryQuestions } from "./kanab-quest-school-history-selection";
import { createKqSchoolBotanySelection } from "./kanab-quest-school-botany-selection";
import { createKqSchoolTerpenesSelection } from "./kanab-quest-school-terpenes-selection";
import { createKqSchoolCultivationSelection } from "./kanab-quest-school-cultivation-selection";
import { createKqSchoolCannabinoidsSelection } from "./kanab-quest-school-cannabinoids-selection";
import { parseKqSchoolSubmission, type KqSchoolQuiz, type KqSchoolSubmission } from "./kanab-quest-school";
import { KQ_SCHOOL_HEALTH_LESSON_IDS, KQ_SCHOOL_HEALTH_CHECKPOINT_IDS, KQ_SCHOOL_HEALTH_ACTIVITY_IDS } from "./kanab-quest-school-health-progress";

const owner = "12345678-1234-4123-8123-123456789abc", other = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
beforeEach(() => vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-school-signature-test-secret-not-a-real-key"));
afterEach(() => vi.unstubAllEnvs());
function submission(quiz: KqSchoolQuiz, score = 10): KqSchoolSubmission {
  const parsed = parseKqSchoolSubmission({ requestKey: owner, quizId: "biodiversity", contentVersion: quiz.contentVersion, selectionId: quiz.selectionId,
    answers: quiz.questions.map((question, index) => ({ questionId: question.id, optionId: index < score ? getKqSchoolAnswer(question.id)!.correctOptionId
      : question.options.find(option => option.id !== getKqSchoolAnswer(question.id)!.correctOptionId)!.id })) });
  if (!parsed) throw new Error("Invalid health test submission");
  return parsed;
}
describe("signed health synthesis", () => {
  it("preserves the original 100 answer keys separately from all 32 detailed health keys", () => {
    expect(Object.keys(KQ_SCHOOL_ANSWERS)).toHaveLength(100);
    expect(HEALTH_QUESTIONS).toHaveLength(32);
    for (const question of HEALTH_QUESTIONS) {
      const answer = getKqSchoolAnswer(question.id)!;
      expect(question.options.some(option => option.id === answer.correctOptionId)).toBe(true);
      expect(Object.keys(answer.optionExplanations ?? {}).sort()).toEqual(question.options.map(option => option.id).sort());
      expect(Object.values(answer.optionExplanations ?? {}).every(text => text.length > 15)).toBe(true);
    }
  });
  it("keeps progress IDs synchronized with actual authored lessons and activities", () => {
    expect(HEALTH_CHAPTERS.flatMap(chapter => chapter.lessons.map(lesson => lesson.id)).sort()).toEqual([...KQ_SCHOOL_HEALTH_LESSON_IDS].sort());
    expect(HEALTH_CHAPTERS.map(chapter => chapter.checkpoint.id).sort()).toEqual([...KQ_SCHOOL_HEALTH_CHECKPOINT_IDS].sort());
    expect(HEALTH_CHAPTERS.flatMap(chapter => chapter.lessons.map(lesson => lesson.activity.id)).sort()).toEqual([...KQ_SCHOOL_HEALTH_ACTIVITY_IDS].sort());
  });
  it("selects ten unique questions covering all eight chapters and reconstructs the same exact question plan for retries", () => {
    const plans = new Set<string>();
    for (let index = 0; index < 20; index++) {
      const quiz = getKqSchoolQuiz("biodiversity", owner);
      expect(quiz.contentVersion).toBe(VERSION); expect(quiz.questions).toHaveLength(10);
      const plan = selectKqSchoolHealthQuestions(owner, quiz.selectionId)!;
      expect(new Set(plan.map(question => question.chapterId)).size).toBe(8);
      expect(new Set(plan.map(question => question.id)).size).toBe(10);
      expect([...new Set(plan.map(question => question.chapterId))].map(chapter => plan.filter(question => question.chapterId === chapter).length).sort()).toEqual([1, 1, 1, 1, 1, 1, 2, 2]);
      expect(plan.map(question => question.id)).toEqual(quiz.questions.map(question => question.id));
      expect(selectKqSchoolHealthQuestions(owner, quiz.selectionId)).toEqual(plan);
      plans.add(plan.map(question => question.id).join(","));
      expect(JSON.stringify(quiz)).not.toContain("correctOptionId");
      expect(JSON.stringify(quiz)).not.toContain("optionExplanations");
    }
    expect(plans.size).toBeGreaterThan(1);
  });
  it("grades zero through ten against reference answers and returns all distractor explanations", () => {
    const quiz = getKqSchoolQuiz("biodiversity", owner);
    for (let score = 0; score <= 10; score++) {
      const graded = gradeKqSchoolSubmission(submission(quiz, score), owner)!;
      expect(graded.score).toBe(score); expect(graded.corrections).toHaveLength(10);
      expect(graded.corrections.every(correction => Object.keys(correction.optionExplanations ?? {}).length === 4)).toBe(true);
    }
  });
  it("never grades another owner's selector, a forged selector, or a missing selector", () => {
    const quiz = getKqSchoolQuiz("biodiversity", owner), valid = submission(quiz);
    expect(gradeKqSchoolSubmission(valid, other)).toBeNull();
    const last = valid.selectionId!.slice(-1) === "a" ? "b" : "a";
    expect(gradeKqSchoolSubmission({ ...valid, selectionId: valid.selectionId!.slice(0, -1) + last }, owner)).toBeNull();
    expect(gradeKqSchoolSubmission({ ...valid, selectionId: undefined }, owner)).toBeNull();
    expect(selectKqSchoolHistoryQuestions(owner, valid.selectionId)).toBeNull();
    expect(selectKqSchoolHealthQuestions(owner, createKqSchoolHistorySelection(owner))).toBeNull();
    expect(selectKqSchoolHealthQuestions(owner, createKqSchoolHistorySelection(owner).replace("h1.", "p1."))).toBeNull();
    for (const create of [createKqSchoolBotanySelection, createKqSchoolTerpenesSelection, createKqSchoolCannabinoidsSelection, createKqSchoolCultivationSelection]) {
      const foreign = create(owner);
      expect(selectKqSchoolHealthQuestions(owner, foreign)).toBeNull();
      expect(selectKqSchoolHealthQuestions(owner, `p1.${foreign.slice(3)}`)).toBeNull();
    }
  });
  it("rejects replacing a selected question or option even with a genuine signature", () => {
    const quiz = getKqSchoolQuiz("biodiversity", owner), value = submission(quiz);
    const unselected = HEALTH_QUESTIONS.find(question => !quiz.questions.some(selected => selected.id === question.id))!;
    const replacement = { ...value, answers: value.answers.map((answer, index) => index ? answer : { questionId: unselected.id, optionId: getKqSchoolAnswer(unselected.id)!.correctOptionId }) };
    expect(() => gradeKqSchoolSubmission(replacement, owner)).toThrow(/question/);
    value.answers[0].optionId = "invented";
    expect(() => gradeKqSchoolSubmission(value, owner)).toThrow(/réponse/);
  });
  it("uses old editions or rotated signing keys only for immutable receipt recovery", () => {
    const value = submission(getKqSchoolQuiz("biodiversity", owner));
    expect(gradeKqSchoolSubmission({ ...value, contentVersion: "2026-11-11.1" }, owner)).toBeNull();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "rotated-local-test-key");
    expect(gradeKqSchoolSubmission(value, owner)).toBeNull();
  });
});
