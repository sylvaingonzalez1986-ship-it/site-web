import { describe, expect, it } from "vitest";
import { createKqSchoolChallengePlan } from "./kanab-quest-school-challenge-server";
import { HEMP_QUIZ_BANK } from "./kanab-quest-hemp-quiz-bank";
describe("private20-question challenge plan", () => {
  it("draws 16 active, 2 food and 2 materials questions, with five questions per editorial level", () => {
    for (let index = 0; index < 30; index++) {
      const plan = createKqSchoolChallengePlan("test-seed-" + index);
      expect(plan.questions).toHaveLength(20); expect(new Set(plan.questions.map(q => q.question.id)).size).toBe(20);
      const selected = plan.questions.map(item => HEMP_QUIZ_BANK.find(entry => entry.id === item.question.id)!);
      expect(['active', 'food', 'materials'].map(domain => selected.filter(item => item.domain === domain).length)).toEqual([16, 2, 2]);
      expect(new Set(selected.map(item => item.subjectKey || item.id)).size).toBe(20);
      for (let level = 1; level <= 4; level++) {
        expect(selected.filter(item => item.level === level && item.domain === 'active')).toHaveLength(4);
        expect(selected.filter(item => item.level === level && item.domain !== 'active')).toHaveLength(1);
      }
      plan.questions.forEach(({ question, answer }, position) => {
        expect(question.level).toBe(Math.floor(position / 5) + 1); expect(question.level).toBe(HEMP_QUIZ_BANK.find(item => item.id === question.id)?.level);
        expect(question.options.some(option => option.id === answer.correctOptionId)).toBe(true);
        const original = HEMP_QUIZ_BANK.find(item => item.id === question.id)!;
        expect(question.options).toHaveLength(4);
        expect(question.options.find(option => option.id === answer.correctOptionId)?.text).toBe(original.options[original.answer]);
        if (position % 5 === 0) expect(original.domain).toBe('active');
        expect(question).not.toHaveProperty("correctOptionId"); expect(question).not.toHaveProperty("explanation");
        expect(question).not.toHaveProperty("domain"); expect(question).not.toHaveProperty("subjectKey");
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
