import { describe, expect, it } from "vitest";
import { CONTEST_SCORE_CRITERIA } from "@/types/contest";
import { getNotebookLessonGuide, NOTEBOOK_LESSON_CHECKPOINTS } from "./arena-notebook-lesson-guide";
import { getReleveLessonGuide } from "./arena-releve-lesson-guide";

describe("Carnet — explanations advance only with the player's confirmation", () => {
  it("starts with an explicit mode choice and keeps its optional details separate", () => {
    const first = getNotebookLessonGuide([])[0];
    expect(first.id).toBe("notebook:mode");
    expect(first.checkpoint?.readySelector).toContain('data-notebook-mode-confirmed="true"');
    const details = getNotebookLessonGuide([first.id])[0];
    expect(details.id).toBe("notebook:mode-details");
    expect(details.checkpoint?.readySelector).toBeUndefined();
  });

  it("does not skip an earlier explanation when later fields were explored", () => {
    const acknowledgements = ["notebook:mode", "notebook:mode-details", "notebook:score-scale", "notebook:score-manicure"];
    const before = [...acknowledgements];
    const steps = getNotebookLessonGuide(acknowledgements);
    expect(steps[0].id).toBe("notebook:score-appearance");
    expect(steps[0].selector).not.toContain("Non évalué");
    expect(steps[0].checkpoint?.readySelector).toContain('data-notebook-evaluated="true"');
    expect(steps.find(step => step.id === "notebook:resume-page-1")?.selector).toContain('data-notebook-page-link="1"');
    expect(acknowledgements).toEqual(before);
  });

  it("teaches every scoring line and keeps checkbox learning before the aroma scores", () => {
    const ids = NOTEBOOK_LESSON_CHECKPOINTS.map(step => step.id);
    expect(ids.filter(id => id.startsWith("notebook:score-") && id !== "notebook:score-scale"))
      .toEqual(CONTEST_SCORE_CRITERIA.map(criterion => `notebook:score-${criterion}`));
    expect(ids.indexOf("notebook:aromas-review")).toBeLessThan(ids.indexOf("notebook:score-cold_aroma"));
    expect(ids.indexOf("notebook:other-aroma")).toBeLessThan(ids.indexOf("notebook:other-aroma-detail"));
    expect(ids.indexOf("notebook:profile")).toBeLessThan(ids.indexOf("notebook:score-overall_impression"));
  });

  it("still requires the native submission after all explanations were acknowledged", () => {
    const acknowledgements = NOTEBOOK_LESSON_CHECKPOINTS.map(step => step.id);
    expect(getReleveLessonGuide("notebook", { complete: false, instruction: "" }, acknowledgements)[0].id).toBe("notebook:submit");
    expect(getReleveLessonGuide("notebook", { complete: true, instruction: "" }, acknowledgements)[0].id).toBe("notebook:complete");
    expect(getNotebookLessonGuide([])[0].id).toBe("notebook:mode");
  });
});
