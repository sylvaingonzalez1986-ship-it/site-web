import { describe, expect, it } from "vitest";
import { createKqSchoolChallengePlan } from "./kanab-quest-school-challenge-server";
import { HEMP_QUIZ_BANK } from "./kanab-quest-hemp-quiz-bank";
import { HEMP_QUIZ_TOPICS } from "./kanab-quest-hemp-quiz-meta";
describe("private20-question challenge plan", () => {
  it("draws unique questions, all active themes and exactly five questions per editorial level", () => {
    for (let index = 0; index < 30; index++) {
      const plan = createKqSchoolChallengePlan("test-seed-" + index);
      expect(plan.questions).toHaveLength(20); expect(new Set(plan.questions.map(q => q.question.id)).size).toBe(20);
      expect(new Set(plan.questions.map(q => q.question.themeId))).toEqual(new Set(HEMP_QUIZ_TOPICS.map(topic => topic.id)));
      plan.questions.forEach(({ question, answer }, position) => {
        expect(question.level).toBe(Math.floor(position / 5) + 1); expect(question.level).toBe(HEMP_QUIZ_BANK.find(item => item.id === question.id)?.level);
        expect(question.options.some(option => option.id === answer.correctOptionId)).toBe(true);
        expect(question).not.toHaveProperty("correctOptionId"); expect(question).not.toHaveProperty("explanation");
        expect(question.lessonId).toBe("reference");
        expect(question.id).toMatch(/^hemp-/);
      });
    }
  });
  it("keeps question and option ordering stable for the stored seed and varies fresh plans", () => {
    expect(createKqSchoolChallengePlan("same-seed")).toEqual(createKqSchoolChallengePlan("same-seed"));
    expect(createKqSchoolChallengePlan("other-seed")).not.toEqual(createKqSchoolChallengePlan("same-seed"));
    const arrangements = new Set(Array.from({ length: 12 }, (_, index) => createKqSchoolChallengePlan(String(index)).questions[0].question.options.map(o => o.id).join("")));
    expect(arrangements.size).toBeGreaterThan(1);
  });
});
