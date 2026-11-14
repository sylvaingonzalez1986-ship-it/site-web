import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getKqSchoolModule } from "@/lib/kanab-quest-school-content";
import type { KqSchoolQuizDraft } from "@/lib/kanab-quest-school-quiz-state";
import { KqSchoolQuiz } from "./KqSchoolQuiz";
const quizModule = getKqSchoolModule("law")!;
const draft = (): KqSchoolQuizDraft => ({ quiz: { quizId: "law", contentVersion: quizModule.version, questions: [...quizModule.questions] }, requestKey: "12345678-1234-4123-8123-123456789abc", answers: {}, index: 0, submitted: false });
function render(value: KqSchoolQuizDraft) { return renderToStaticMarkup(createElement(KqSchoolQuiz, { draft: value, title: "Quiz", busy: false, error: "", obsolete: false, conflicted: false, rewardLabel: "Budget du serveur", onChange: () => {}, onCheck: () => {}, onSubmit: () => {}, onRestart: () => {}, onRecover: () => {}, onRead: () => {}, onOtherQuizzes: () => {}, sources: () => null, buddies: () => null })); }
describe("one question quiz presentation", () => {
  it("shows four native radio choices and no premature correct answer", () => {
    const html = render(draft());
    expect(html.match(/type="radio"/g)).toHaveLength(4); expect(html).toContain("data-quiz-check");
    expect(html).not.toContain("data-quiz-feedback="); expect(html).not.toContain(quizModule.questions[1].prompt);
  });
  it("explains an incorrect checked choice and locks all answers until Next", () => {
    const value = draft(), question = value.quiz.questions[0]; value.answers[question.id] = "a";
    value.checks = { [question.id]: { questionId: question.id, optionId: "a", correctOptionId: "b", isCorrect: false, explanation: "La preuve utile explique ce choix.", lessonId: "law", sectionId: "law-1", sources: [] } };
    const html = render(value);
    expect(html).toContain('data-quiz-feedback="incorrect"'); expect(html).toContain("Bonne réponse");
    expect(html).toContain("data-quiz-next"); expect(html).toContain("<fieldset"); expect(html).toMatch(/<fieldset[^>]+disabled/);
    expect(html).toContain("Comprendre et vérifier");
  });
  it("offers the same validation again after an uncertain request", () => {
    const value = draft(); value.answers[value.quiz.questions[0].id] = "a"; value.pendingCheckId = value.quiz.questions[0].id;
    const html = render(value); expect(html).toContain("Réessayer cette réponse"); expect(html).toMatch(/<fieldset[^>]+disabled/);
    expect(html).not.toContain("data-quiz-next");
  });
});
