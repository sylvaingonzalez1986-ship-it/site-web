import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HARVEST_QUESTIONS, HARVEST_CHAPTERS, VERSION } from "./kanab-quest-school-harvest";
import { KQ_SCHOOL_ANSWERS, getKqSchoolAnswer } from "./kanab-quest-school-answers";
import { getKqSchoolQuiz, gradeKqSchoolSubmission } from "./kanab-quest-school-server";
import { selectKqSchoolHarvestQuestions } from "./kanab-quest-school-harvest-selection";
import { createKqSchoolHistorySelection, selectKqSchoolHistoryQuestions } from "./kanab-quest-school-history-selection";
import { createKqSchoolBotanySelection, selectKqSchoolBotanyQuestions } from "./kanab-quest-school-botany-selection";
import { createKqSchoolTerpenesSelection } from "./kanab-quest-school-terpenes-selection";
import { createKqSchoolCannabinoidsSelection } from "./kanab-quest-school-cannabinoids-selection";
import { createKqSchoolCultivationSelection } from "./kanab-quest-school-cultivation-selection";
import { createKqSchoolHealthSelection } from "./kanab-quest-school-health-selection";
import { createKqSchoolProductsSelection } from "./kanab-quest-school-products-selection";
import { createKqSchoolSoilSelection } from "./kanab-quest-school-soil-selection";
import { parseKqSchoolSubmission, type KqSchoolQuiz, type KqSchoolSubmission } from "./kanab-quest-school";
import { KQ_SCHOOL_HARVEST_LESSON_IDS, KQ_SCHOOL_HARVEST_CHECKPOINT_IDS, KQ_SCHOOL_HARVEST_ACTIVITY_IDS } from "./kanab-quest-school-harvest-progress";

const owner = "12345678-1234-4123-8123-123456789abc", other = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
beforeEach(() => vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-school-signature-test-secret-not-a-real-key"));
afterEach(() => vi.unstubAllEnvs());
function submission(quiz: KqSchoolQuiz, score = 10): KqSchoolSubmission {
  const parsed = parseKqSchoolSubmission({ requestKey: owner, quizId: "prevention", contentVersion: quiz.contentVersion, selectionId: quiz.selectionId,
    answers: quiz.questions.map((question, index) => ({ questionId: question.id, optionId: index < score ? getKqSchoolAnswer(question.id)!.correctOptionId
      : question.options.find(option => option.id !== getKqSchoolAnswer(question.id)!.correctOptionId)!.id })) });
  if (!parsed) throw new Error("Invalid harvest test submission");
  return parsed;
}
describe("signed harvest synthesis", () => {
  it("preserves the original 100 answer keys separately from all 36 detailed harvest keys", () => {
    expect(Object.keys(KQ_SCHOOL_ANSWERS)).toHaveLength(100);
    expect(HARVEST_QUESTIONS).toHaveLength(36);
    for (const question of HARVEST_QUESTIONS) {
      const answer = getKqSchoolAnswer(question.id)!;
      expect(question.options.some(option => option.id === answer.correctOptionId)).toBe(true);
      expect(Object.keys(answer.optionExplanations ?? {}).sort()).toEqual(question.options.map(option => option.id).sort());
      expect(Object.values(answer.optionExplanations ?? {}).every(text => text.length > 15)).toBe(true);
    }
  });
  it("keeps progress IDs synchronized with actual authored lessons and activities", () => {
    expect(HARVEST_CHAPTERS.flatMap(chapter => chapter.lessons.map(lesson => lesson.id)).sort()).toEqual([...KQ_SCHOOL_HARVEST_LESSON_IDS].sort());
    expect(HARVEST_CHAPTERS.map(chapter => chapter.checkpoint.id).sort()).toEqual([...KQ_SCHOOL_HARVEST_CHECKPOINT_IDS].sort());
    expect(HARVEST_CHAPTERS.flatMap(chapter => chapter.lessons.map(lesson => lesson.activity.id)).sort()).toEqual([...KQ_SCHOOL_HARVEST_ACTIVITY_IDS].sort());
  });
  it("selects ten unique questions covering all nine chapters and reconstructs the same exact question plan for retries", () => {
    const plans = new Set<string>(), doubledChapters = new Set<string>();
    for (let index = 0; index < 20; index++) {
      const quiz = getKqSchoolQuiz("prevention", owner);
      expect(quiz.contentVersion).toBe(VERSION); expect(quiz.questions).toHaveLength(10);
      const plan = selectKqSchoolHarvestQuestions(owner, quiz.selectionId)!;
      expect(new Set(plan.map(question => question.chapterId)).size).toBe(9);
      expect(new Set(plan.map(question => question.id)).size).toBe(10);
      expect([...new Set(plan.map(question => question.chapterId))].map(chapter => plan.filter(question => question.chapterId === chapter).length).sort()).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 2]);
      doubledChapters.add(plan.find(question => plan.filter(other => other.chapterId === question.chapterId).length === 2)!.chapterId);
      expect(plan.map(question => question.id)).toEqual(quiz.questions.map(question => question.id));
      expect(selectKqSchoolHarvestQuestions(owner, quiz.selectionId)).toEqual(plan);
      plans.add(plan.map(question => question.id).join(","));
      expect(JSON.stringify(quiz)).not.toContain("correctOptionId");
      expect(JSON.stringify(quiz)).not.toContain("optionExplanations");
    }
    expect(plans.size).toBeGreaterThan(1);
    expect(doubledChapters.size).toBeGreaterThan(1);
  });
  it("grades zero through ten against reference answers and returns all distractor explanations", () => {
    const quiz = getKqSchoolQuiz("prevention", owner);
    for (let score = 0; score <= 10; score++) {
      const graded = gradeKqSchoolSubmission(submission(quiz, score), owner)!;
      expect(graded.score).toBe(score); expect(graded.corrections).toHaveLength(10);
      expect(graded.corrections.every(correction => Object.keys(correction.optionExplanations ?? {}).length === 4)).toBe(true);
    }
  });
  it("never grades another owner's selector, a forged selector, or a missing selector", () => {
    const quiz = getKqSchoolQuiz("prevention", owner), valid = submission(quiz);
    expect(gradeKqSchoolSubmission(valid, other)).toBeNull();
    const last = valid.selectionId!.slice(-1) === "a" ? "b" : "a";
    expect(gradeKqSchoolSubmission({ ...valid, selectionId: valid.selectionId!.slice(0, -1) + last }, owner)).toBeNull();
    expect(gradeKqSchoolSubmission({ ...valid, selectionId: undefined }, owner)).toBeNull();
    expect(selectKqSchoolHistoryQuestions(owner, valid.selectionId)).toBeNull();
    expect(selectKqSchoolHarvestQuestions(owner, createKqSchoolHistorySelection(owner))).toBeNull();
    expect(selectKqSchoolHarvestQuestions(owner, createKqSchoolHistorySelection(owner).replace("h1.", "r1."))).toBeNull();
    for (const create of [createKqSchoolTerpenesSelection, createKqSchoolCannabinoidsSelection, createKqSchoolCultivationSelection, createKqSchoolHealthSelection, createKqSchoolSoilSelection, createKqSchoolProductsSelection]) {
      const foreign = create(owner);
      expect(selectKqSchoolHarvestQuestions(owner, foreign)).toBeNull();
      expect(selectKqSchoolHarvestQuestions(owner, `r1.${foreign.slice(3)}`)).toBeNull();
    }
    expect(selectKqSchoolBotanyQuestions(owner, valid.selectionId)).toBeNull();
    expect(selectKqSchoolHarvestQuestions(owner, createKqSchoolBotanySelection(owner).replace("b1.", "r1."))).toBeNull();
  });
  it("rejects replacing a selected question or option even with a genuine signature", () => {
    const quiz = getKqSchoolQuiz("prevention", owner), value = submission(quiz);
    const unselected = HARVEST_QUESTIONS.find(question => !quiz.questions.some(selected => selected.id === question.id))!;
    const replacement = { ...value, answers: value.answers.map((answer, index) => index ? answer : { questionId: unselected.id, optionId: getKqSchoolAnswer(unselected.id)!.correctOptionId }) };
    expect(() => gradeKqSchoolSubmission(replacement, owner)).toThrow(/question/);
    value.answers[0].optionId = "invented";
    expect(() => gradeKqSchoolSubmission(value, owner)).toThrow(/réponse/);
  });
  it("uses old editions or rotated signing keys only for immutable receipt recovery", () => {
    const value = submission(getKqSchoolQuiz("prevention", owner));
    expect(gradeKqSchoolSubmission({ ...value, contentVersion: "2026-11-11.1" }, owner)).toBeNull();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "rotated-local-test-key");
    expect(gradeKqSchoolSubmission(value, owner)).toBeNull();
  });
});
