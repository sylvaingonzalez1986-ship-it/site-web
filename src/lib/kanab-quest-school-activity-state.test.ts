import { describe, expect, it } from "vitest";
import type { HistoryActivity } from "./kanab-quest-school-history-types";
import {
  activityStepStatus, isActivityStepReady, isActivityValidated, lastReachableActivityStep,
  restoreSchoolActivityDraft, updateSchoolActivityDraft, type SchoolActivityDraft,
} from "./kanab-quest-school-activity-state";

const activity: HistoryActivity = {
  id: "test-activity", kind: "choice", title: "Deux décisions", scenario: "Exemple fictif.", fictional: true,
  evaluates: "Conclusion et preuve.", takeaway: "Conserver les limites.", steps: [
    { id: "first", prompt: "Quelle conclusion ?", sourceIds: [], choices: [
      { id: "a", text: "Observer.", correct: true, feedback: "La mesure manque." },
      { id: "b", text: "Mettre en attente.", correct: true, feedback: "La précaution est proportionnée." },
      { id: "c", text: "Conclure sans mesure.", correct: false, feedback: "Le dossier ne le permet pas." },
    ], reasons: [
      { id: "yes", text: "Les données restent insuffisantes.", correct: true, feedback: "Les deux actions préservent cette limite." },
      { id: "no", text: "L'apparence suffit.", correct: false, feedback: "Une apparence ne démontre pas une cause." },
    ] },
    { id: "second", prompt: "Quel suivi ?", sourceIds: [], choices: [
      { id: "a", text: "Mesures comparables.", correct: true, feedback: "Le suivi est interprétable." },
      { id: "b", text: "Changer de méthode sans le noter.", correct: false, feedback: "Les résultats deviennent ambigus." },
    ] },
  ],
};
const apply = (draft: SchoolActivityDraft, action: Parameters<typeof updateSchoolActivityDraft>[2]) => updateSchoolActivityDraft(activity, draft, action);
function verifiedFirst(choice = "a", reason = "yes") {
  let draft = apply(restoreSchoolActivityDraft(activity), { type: "choice", id: choice });
  draft = apply(draft, { type: "justify" });
  draft = apply(draft, { type: "reason", id: reason });
  return apply(draft, { type: "verify" });
}

describe("school activity step validation and drafts", () => {
  it("does not unlock later steps or a summary from unchecked selections", () => {
    let draft = apply(restoreSchoolActivityDraft(activity), { type: "choice", id: "a" });
    expect(isActivityStepReady(activity.steps[0], draft)).toBe(false);
    draft = apply(draft, { type: "verify" });
    expect(activityStepStatus(activity.steps[0], draft)).toBe("pending");
    draft = apply(draft, { type: "reason", id: "yes" });
    expect(isActivityStepReady(activity.steps[0], draft)).toBe(true);
    expect(activityStepStatus(activity.steps[0], draft)).toBe("pending");
    expect(apply(draft, { type: "go", index: 1 }).stepIndex).toBe(0);
    expect(apply(draft, { type: "summary" }).summary).toBe(false);
  });

  it("requires a correct justification even when the conclusion is correct", () => {
    const draft = verifiedFirst("a", "no");
    expect(activityStepStatus(activity.steps[0], draft)).toBe("incorrect");
    expect(lastReachableActivityStep(activity, draft)).toBe(0);
    const retry = apply(draft, { type: "retry" });
    expect(retry.answerStage).toBe("reason");
    expect(retry.choices.first).toBe("a");
    expect(activityStepStatus(activity.steps[0], retry)).toBe("pending");
  });

  it.each(["a", "b"])("accepts the documented alternative %s and only completes after both steps are verified", choice => {
    let draft = verifiedFirst(choice);
    expect(activityStepStatus(activity.steps[0], draft)).toBe("correct");
    expect(isActivityValidated(activity, draft)).toBe(false);
    draft = apply(draft, { type: "go", index: 1 });
    draft = apply(draft, { type: "choice", id: "a" });
    expect(isActivityValidated(activity, draft)).toBe(false);
    draft = apply(draft, { type: "verify" });
    expect(isActivityValidated(activity, draft)).toBe(true);
    expect(draft.summary).toBe(false);
    expect(apply(draft, { type: "summary" }).summary).toBe(true);
  });

  it("invalidates only the edited step and clears an old reason when its conclusion changes", () => {
    let draft = verifiedFirst();
    draft = apply(draft, { type: "go", index: 1 });
    draft = apply(draft, { type: "choice", id: "a" });
    draft = apply(draft, { type: "verify" });
    draft = apply(draft, { type: "go", index: 0 });
    draft = apply(draft, { type: "retry" });
    draft = apply(draft, { type: "choice", id: "c" });
    expect(draft.reasons.first).toBeUndefined();
    expect(activityStepStatus(activity.steps[0], draft)).toBe("pending");
    expect(activityStepStatus(activity.steps[1], draft)).toBe("correct");
    expect(isActivityValidated(activity, draft)).toBe(false);
  });

  it("migrates legacy checked drafts, preserving incorrect feedback without unlocking the summary", () => {
    const saved = { choices: { first: "a", second: "a" }, reasons: { first: "no" }, checked: true, stepIndex: 1 };
    const draft = restoreSchoolActivityDraft(activity, saved);
    expect(draft.stepIndex).toBe(0);
    expect(activityStepStatus(activity.steps[0], draft)).toBe("incorrect");
    expect(activityStepStatus(activity.steps[1], draft)).toBe("correct");
    expect(draft.summary).toBe(false);
    const passed = restoreSchoolActivityDraft(activity, { ...saved, reasons: { first: "yes" } });
    expect(isActivityValidated(activity, passed)).toBe(true);
    expect(passed.summary).toBe(true);
  });

  it("preserves legacy unchecked answers but never invents a verification", () => {
    const draft = restoreSchoolActivityDraft(activity, { choices: { first: "a", second: "a" }, reasons: { first: "yes" }, checked: false, stepIndex: 1 });
    expect(draft.choices).toEqual({ first: "a", second: "a" });
    expect(draft.reasons).toEqual({ first: "yes" });
    expect(draft.attempts).toEqual({});
    expect(draft.stepIndex).toBe(0);
    expect(draft.answerStage).toBe("reason");
  });

  it("restores current attempts and phase, rejecting stale stamps and foreign option IDs", () => {
    const failed = verifiedFirst("c", "yes");
    expect(restoreSchoolActivityDraft(activity, JSON.parse(JSON.stringify(failed)))).toEqual(failed);
    const stale = restoreSchoolActivityDraft(activity, { ...failed, choices: { first: "a", second: "missing" }, summary: true, stepIndex: 999 });
    expect(stale.choices).toEqual({ first: "a" });
    expect(stale.attempts).toEqual({});
    expect(stale.summary).toBe(false);
    expect(stale.stepIndex).toBe(0);
  });

  it("keeps keyboard choice and justification phases explicit and resumable", () => {
    let draft = restoreSchoolActivityDraft(activity);
    expect(apply(draft, { type: "justify" }).answerStage).toBe("choice");
    draft = apply(draft, { type: "choice", id: "a" });
    expect(draft.answerStage).toBe("choice");
    draft = apply(draft, { type: "justify" });
    expect(draft.answerStage).toBe("reason");
    expect(restoreSchoolActivityDraft(activity, draft).answerStage).toBe("reason");
    expect(apply(draft, { type: "edit-choice" }).answerStage).toBe("choice");
  });

  it("tolerates corrupted drafts and cannot validate an empty activity", () => {
    for (const saved of [null, false, [], "broken", { choices: { first: 3 }, reasons: {}, checked: true, stepIndex: -4 }]) {
      expect(restoreSchoolActivityDraft(activity, saved).attempts).toEqual({});
    }
    const empty = { ...activity, steps: [] };
    expect(isActivityValidated(empty, restoreSchoolActivityDraft(empty))).toBe(false);
    expect(apply(restoreSchoolActivityDraft(activity), { type: "choice", id: "foreign" }).choices).toEqual({});
  });
});
