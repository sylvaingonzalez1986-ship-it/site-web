import { describe, expect, it } from "vitest";
import { getKqSchoolModule } from "./kanab-quest-school-content";
import { nextQuizQuestion, quizQuestionLocked, readKqSchoolQuizDraft, shortQuizExplanation, type KqSchoolQuizDraft } from "./kanab-quest-school-quiz-state";
const quiz = getKqSchoolModule("law")!;
const draft = (): KqSchoolQuizDraft => ({ quiz: { quizId: "law", contentVersion: quiz.version, questions: [...quiz.questions] }, requestKey: "12345678-1234-4123-8123-123456789abc", answers: {}, index: 0, submitted: false });
const correction = (id: string) => ({ questionId: id, optionId: "a", correctOptionId: "b", isCorrect: false, explanation: "Une explication conservée.", lessonId: "law", sectionId: "law-1", sources: [] });
describe("quiz reading breaks and uncertain requests", () => {
  it("retains and locks a pending choice across reload, including a legacy draft", () => {
    const value = draft(), id = value.quiz.questions[3].id;
    value.answers[id] = "a"; value.pendingCheckId = id; value.index = 3;
    const restored = readKqSchoolQuizDraft(JSON.parse(JSON.stringify(value)))!;
    expect(restored.index).toBe(3); expect(restored.answers[id]).toBe("a"); expect(quizQuestionLocked(restored, id)).toBe(true);
    expect(readKqSchoolQuizDraft(value, "plant")).toBeNull();
  });
  it("revalidates old unsent choices without discarding them or fabricating corrections", () => {
    const value = draft(); value.index = 7; value.answers[value.quiz.questions[0].id] = "a";
    const restored = readKqSchoolQuizDraft(value)!;
    expect(restored.index).toBe(0); expect(restored.answers).toEqual(value.answers); expect(restored.checks).toEqual({});
    value.submitted = true; expect(readKqSchoolQuizDraft(value)?.index).toBe(7);
  });
  it("keeps checked answers immutable and only finishes after all ten checks", () => {
    const value = draft(); value.checks = {};
    for (const question of value.quiz.questions) { value.answers[question.id] = "a"; value.checks[question.id] = correction(question.id); }
    expect(nextQuizQuestion(value)).toBeNull(); expect(quizQuestionLocked(value, value.quiz.questions[0].id)).toBe(true);
    delete value.checks[value.quiz.questions[2].id]; value.index = 9;
    expect(nextQuizQuestion(value)).toBe(2);
    value.checks[value.quiz.questions[2].id] = { ...correction(value.quiz.questions[2].id), optionId: "d" };
    expect(readKqSchoolQuizDraft(value)?.checks?.[value.quiz.questions[2].id]).toBeUndefined();
  });
  it("shortens only the immediate explanation, preserving the complete source text", () => {
    const text = "Une phrase suffisamment longue pour expliquer clairement la réponse. " + "Un détail secondaire. ".repeat(30);
    expect(shortQuizExplanation(text)).toBe("Une phrase suffisamment longue pour expliquer clairement la réponse.");
    expect(text.length).toBeGreaterThan(220);
  });
});
