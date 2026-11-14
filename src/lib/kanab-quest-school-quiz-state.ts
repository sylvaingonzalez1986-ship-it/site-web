import { isKqSchoolQuizId, isKqSchoolUuid, type KqSchoolQuiz, type KqSchoolCompletion, type KqSchoolCorrection } from "./kanab-quest-school";
export type KqSchoolQuizDraft = { quiz: KqSchoolQuiz; requestKey: string; answers: Record<string, string>; index: number; submitted: boolean; completion?: KqSchoolCompletion; openCorrectionId?: string; checks?: Record<string, KqSchoolCorrection>; pendingCheckId?: string };
export function readKqSchoolQuizDraft(value: unknown, quizId?: string): KqSchoolQuizDraft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as KqSchoolQuizDraft;
  if (!isKqSchoolQuizId(draft.quiz?.quizId) || (quizId && quizId !== draft.quiz.quizId) || !isKqSchoolUuid(draft.requestKey)
    || !Array.isArray(draft.quiz.questions) || draft.quiz.questions.length !== 10 || new Set(draft.quiz.questions.map(q => q.id)).size !== 10
    || !draft.quiz.questions.every(q => typeof q.id === "string" && Array.isArray(q.options) && q.options.length === 4)
    || !draft.answers || typeof draft.answers !== "object" || !Number.isInteger(draft.index) || draft.index < 0 || draft.index > 9) return null;
  const answers: Record<string, string> = {}, checks: Record<string, KqSchoolCorrection> = {};
  for (const question of draft.quiz.questions) {
    const selected = draft.answers[question.id];
    if (question.options.some(option => option.id === selected)) answers[question.id] = selected;
    const check = draft.checks?.[question.id];
    if (check?.questionId === question.id && check.optionId === selected && typeof check.isCorrect === "boolean"
      && typeof check.explanation === "string" && Array.isArray(check.sources) && typeof check.lessonId === "string" && typeof check.sectionId === "string"
      && question.options.some(option => option.id === check.correctOptionId)) checks[question.id] = check;
  }
  const pendingCheckId = draft.pendingCheckId && answers[draft.pendingCheckId] && !checks[draft.pendingCheckId] ? draft.pendingCheckId : undefined;
  const index = pendingCheckId ? draft.quiz.questions.findIndex(q => q.id === pendingCheckId)
    : !draft.submitted && !draft.completion && !draft.checks ? 0 : draft.index;
  return { ...draft, answers, checks, index, pendingCheckId };
}
export function quizQuestionLocked(draft: KqSchoolQuizDraft, questionId: string) {
  return draft.submitted || Boolean(draft.checks?.[questionId]) || draft.pendingCheckId === questionId;
}
export function nextQuizQuestion(draft: KqSchoolQuizDraft): number | null {
  const pending = draft.quiz.questions.map((q, index) => ({ q, index })).filter(({ q }) => !draft.checks?.[q.id]);
  return pending.find(({ index }) => index > draft.index)?.index ?? pending[0]?.index ?? null;
}
export function shortQuizExplanation(text: string): string {
  if (text.length <= 220) return text;
  const sentence = text.match(/^.{40,220}?[.!?](?:\s|$)/)?.[0]?.trim();
  return sentence ?? text.slice(0, 217).replace(/\s+\S*$/, "") + "…";
}
