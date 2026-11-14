import type { HistoryActivity, HistoryStep } from "./kanab-quest-school-history-types";

type Attempt = { choiceId: string; reasonId?: string };
export type SchoolActivityDraft = {
  version: 2; choices: Record<string, string>; reasons: Record<string, string>;
  attempts: Record<string, Attempt>; stepIndex: number; summary: boolean; answerStage: "choice" | "reason";
};
export type SchoolActivityAction =
  | { type: "choice" | "reason"; id: string }
  | { type: "verify" | "retry" | "summary" | "justify" | "edit-choice" }
  | { type: "go"; index: number };

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function isActivityStepReady(step: HistoryStep, draft: SchoolActivityDraft) {
  return step.choices.some(choice => choice.id === draft.choices[step.id])
    && (!step.reasons?.length || step.reasons.some(reason => reason.id === draft.reasons[step.id]));
}
export function activityStepStatus(step: HistoryStep, draft: SchoolActivityDraft): "pending" | "correct" | "incorrect" {
  const attempt = draft.attempts[step.id];
  if (!attempt || !isActivityStepReady(step, draft) || attempt.choiceId !== draft.choices[step.id]
    || (step.reasons?.length && attempt.reasonId !== draft.reasons[step.id])) return "pending";
  return step.choices.find(choice => choice.id === attempt.choiceId)?.correct
    && (!step.reasons?.length || step.reasons.find(reason => reason.id === attempt.reasonId)?.correct) ? "correct" : "incorrect";
}
export function isActivityValidated(activity: HistoryActivity, draft: SchoolActivityDraft) {
  return activity.steps.length > 0 && activity.steps.every(step => activityStepStatus(step, draft) === "correct");
}
export function lastReachableActivityStep(activity: HistoryActivity, draft: SchoolActivityDraft) {
  const pending = activity.steps.findIndex(step => activityStepStatus(step, draft) !== "correct");
  return pending < 0 ? Math.max(0, activity.steps.length - 1) : pending;
}
/** A checked legacy draft represents an actual global verification; selections alone do not. */
export function restoreSchoolActivityDraft(activity: HistoryActivity, saved?: unknown): SchoolActivityDraft {
  const draft: SchoolActivityDraft = { version: 2, choices: {}, reasons: {}, attempts: {}, stepIndex: 0, summary: false, answerStage: "choice" };
  const data = object(saved);
  const choices = object(data.choices), reasons = object(data.reasons), attempts = object(data.attempts);
  for (const step of activity.steps) {
    const choiceId = choices[step.id], reasonId = reasons[step.id];
    if (typeof choiceId !== "string" || !step.choices.some(choice => choice.id === choiceId)) continue;
    draft.choices[step.id] = choiceId;
    if (typeof reasonId === "string" && step.reasons?.some(reason => reason.id === reasonId)) draft.reasons[step.id] = reasonId;
    if (!isActivityStepReady(step, draft)) continue;
    const previous = object(attempts[step.id]);
    const legacyChecked = data.version === undefined && data.checked === true;
    if (legacyChecked || (data.version === 2 && previous.choiceId === choiceId
      && (!step.reasons?.length || previous.reasonId === reasonId))) {
      draft.attempts[step.id] = { choiceId, ...(step.reasons?.length ? { reasonId: draft.reasons[step.id] } : {}) };
    }
  }
  draft.stepIndex = Math.min(typeof data.stepIndex === "number" && Number.isInteger(data.stepIndex) ? Math.max(0, data.stepIndex) : 0,
    lastReachableActivityStep(activity, draft));
  draft.summary = isActivityValidated(activity, draft) && (data.summary === true || (data.version === undefined && data.checked === true));
  const step = activity.steps[draft.stepIndex];
  if (step?.reasons?.length && draft.choices[step.id] && (data.answerStage === "reason" || draft.reasons[step.id])) draft.answerStage = "reason";
  return draft;
}
export function updateSchoolActivityDraft(activity: HistoryActivity, draft: SchoolActivityDraft, action: SchoolActivityAction): SchoolActivityDraft {
  if (action.type === "go") {
    if (!Number.isInteger(action.index) || action.index < 0 || action.index > lastReachableActivityStep(activity, draft)) return draft;
    const destination = activity.steps[action.index];
    const answerStage = destination?.reasons?.length && draft.choices[destination.id] && draft.reasons[destination.id] ? "reason" : "choice";
    return { ...draft, stepIndex: action.index, summary: false, answerStage };
  }
  if (action.type === "summary") return isActivityValidated(activity, draft) ? { ...draft, summary: true } : draft;
  const step = activity.steps[draft.stepIndex];
  if (!step) return draft;
  if (action.type === "justify") return draft.choices[step.id] && step.reasons?.length ? { ...draft, answerStage: "reason" } : draft;
  if (action.type === "edit-choice") return { ...draft, answerStage: "choice" };
  if (action.type === "verify") {
    if (!isActivityStepReady(step, draft)) return draft;
    return { ...draft, attempts: { ...draft.attempts, [step.id]: {
      choiceId: draft.choices[step.id], ...(step.reasons?.length ? { reasonId: draft.reasons[step.id] } : {}),
    } }, summary: false };
  }
  if (action.type === "choice" && !step.choices.some(choice => choice.id === action.id)) return draft;
  if (action.type === "reason" && (!draft.choices[step.id] || !step.reasons?.some(reason => reason.id === action.id))) return draft;
  const next = { ...draft, choices: { ...draft.choices }, reasons: { ...draft.reasons }, attempts: { ...draft.attempts }, summary: false };
  delete next.attempts[step.id];
  if (action.type === "retry") next.answerStage = step.reasons?.length && step.choices.find(choice => choice.id === draft.choices[step.id])?.correct ? "reason" : "choice";
  if (action.type === "choice") {
    if (action.id !== draft.choices[step.id]) delete next.reasons[step.id];
    next.choices[step.id] = action.id;
    next.answerStage = "choice";
  }
  if (action.type === "reason") next.reasons[step.id] = action.id;
  return next;
}
