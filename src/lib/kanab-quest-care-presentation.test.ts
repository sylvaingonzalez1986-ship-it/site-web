import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { advanceKqStage, KQ_STAGES, resolveKqStage, startKqGame, type KqGameState, type KqOutcome } from "./kanab-quest-game";
import { createKqCareState, type KqCareProblem } from "./kanab-quest-care";
import { getKqCarePresentation } from "./kanab-quest-care-presentation";
import { KQ_DEAD_CULTURE_ARTWORK, KQ_OUTCOME_ARTWORK, KQ_OUTCOME_LABELS } from "./kanab-quest-outcome-artwork";

const outcomes: KqOutcome[] = ["critical", "success", "fragile", "failure"];
const problem = (severity: 1 | 2 | 3): KqCareProblem => ({ code: "APHIDS", severity, status: "confirmed", trend: "stable", appearedAt: 0, variant: 0 });
const finish = (state: KqGameState) => resolveKqStage({ ...state, phase: "rolled", dice: [6, 6, 6] });
function prepare(index = 0) {
  let state = startKqGame(9);
  while (state.stageIndex < index) state = advanceKqStage(finish(state));
  return { ...state, care: createKqCareState() };
}
function verdict(index: number, outcome: KqOutcome): KqGameState {
  const state = finish(prepare(index));
  return { ...state, care: createKqCareState(), history: state.history.map((entry, item) => item === index ? { ...entry, outcome } : entry) };
}
const exists = (src: string) => existsSync(join(process.cwd(), "public", src.slice(1)));

describe("stage and state aware care presentation", () => {
  it.each(KQ_STAGES.flatMap((stage, index) => outcomes.map(outcome => ({ stage, index, outcome }))))(
    "shows the recorded $outcome at $stage without changing the verdict",
    ({ stage, index, outcome }) => {
      const state = verdict(index, outcome);
      const presentation = getKqCarePresentation(state);
      expect(presentation.artwork).toEqual(expect.objectContaining({ src: KQ_OUTCOME_ARTWORK[stage][outcome].src }));
      expect(presentation).toMatchObject({ stage, stageIndex: index, latestResult: { outcome, label: KQ_OUTCOME_LABELS[outcome] } });
      expect(presentation.condition).toBe(index === 5 ? "harvested" : "healthy");
      expect(presentation.artwork.src).not.toContain("dead");
      expect(exists(presentation.artwork.src)).toBe(true);
    },
  );

  it.each(KQ_STAGES.map((stage, index) => ({ stage, index })))("uses neutral $stage artwork before a verdict", ({ stage, index }) => {
    const state = prepare(index);
    const before = structuredClone(state);
    const presentation = getKqCarePresentation(state);
    expect(presentation.stage).toBe(stage);
    expect(presentation.artwork.src).toMatch(/\/stages\/sylvain-/);
    expect(exists(presentation.artwork.src)).toBe(true);
    expect(getKqCarePresentation({ ...state, phase: "rolled", dice: [1, 1, 1] }).artwork).toEqual(presentation.artwork);
    expect(state).toEqual(before);
  });

  it("switches the plant stage after advancement, keeping the previous result explicitly separate", () => {
    const resolved = verdict(1, "failure");
    const next = advanceKqStage(resolved);
    next.care = { ...createKqCareState(), vitality: 25 };
    const presentation = getKqCarePresentation(next);
    expect(presentation.stage).toBe("Croissance");
    expect(presentation.condition).toBe("critical");
    expect(presentation.artwork.src).toBe(KQ_OUTCOME_ARTWORK.Croissance.failure.src);
    expect(presentation.latestResult).toMatchObject({ stageLabel: "Enracinement", outcome: "failure" });
  });

  it.each([
    { vitality: 100, severity: 1 as const, condition: "watch", image: "fragile", label: "À surveiller" },
    { vitality: 100, severity: 2 as const, condition: "watch", image: "fragile", label: "À surveiller" },
    { vitality: 100, severity: 3 as const, condition: "critical", image: "failure", label: "Alerte critique" },
    { vitality: 60, severity: undefined, condition: "watch", image: "fragile", label: "À surveiller" },
    { vitality: 30, severity: undefined, condition: "critical", image: "failure", label: "Santé critique" },
    { vitality: 0, severity: undefined, condition: "critical", image: "failure", label: "Santé critique" },
  ])("keeps the health warning after a successful operation: $condition, $vitality health, severity $severity", ({ vitality, severity, condition, image, label }) => {
    const state = verdict(3, "critical");
    state.care = { ...state.care!, vitality, problems: severity ? [problem(severity)] : [] };
    const presentation = getKqCarePresentation(state);
    expect(presentation.condition).toBe(condition);
    expect(presentation.conditionLabel).toBe(label);
    expect(presentation.artwork.src).toBe(KQ_OUTCOME_ARTWORK.Floraison[image as KqOutcome].src);
    expect(presentation.latestResult?.outcome).toBe("critical");
    expect(presentation.artwork.src).not.toContain("dead");
  });

  it.each(KQ_STAGES.slice(1).map((stage, offset) => ({ stage, index: offset + 1 })))(
    "uses the actual terminal stage $stage even if the cursor differs", ({ stage, index }) => {
      const state = { ...verdict(index, "fragile"), phase: "complete" as const, stageIndex: 5, cultureDead: true };
      const presentation = getKqCarePresentation(state);
      expect(presentation).toMatchObject({ stage, stageIndex: index, condition: "dead", conditionLabel: "Culture arrêtée" });
      expect(presentation.artwork.src).toBe(KQ_DEAD_CULTURE_ARTWORK[stage as Exclude<typeof stage, "Germination">].src);
      expect(exists(presentation.artwork.src)).toBe(true);
    },
  );

  it("keeps the weak harvested lot distinct from a healed plant after drying", () => {
    const state = verdict(5, "success");
    state.care = { ...state.care!, vitality: 22, problems: [] };
    const presentation = getKqCarePresentation({ ...state, phase: "complete" });
    expect(presentation.condition).toBe("harvested");
    expect(presentation.conditionLabel).toBe("Lot récolté");
    expect(presentation.artwork.src).toBe(KQ_OUTCOME_ARTWORK["Séchage & affinage"].failure.src);
    expect(presentation.stageCaption).toContain("santé conserve le bilan à la récolte");
    expect(presentation.latestResult).toMatchObject({ stageLabel: "Séchage", outcome: "success" });
    expect(presentation.artwork.alt).not.toContain("plante");
  });

  it("reads only the last recorded stage check and does not invent health measurements", () => {
    const state = verdict(1, "success");
    state.care!.history = [
      { stageIndex: 0, kind: "resolution", message: "Ancien bilan", vitalityDelta: -13, terpenesDelta: 0 },
      { stageIndex: 1, kind: "resolution", message: "Bilan récent", vitalityDelta: 4, terpenesDelta: 0 },
      { stageIndex: 1, kind: "intervention", message: "Soin", vitalityDelta: 15, terpenesDelta: 0 },
    ];
    expect(getKqCarePresentation(state).latestResult?.vitalityDelta).toBe(4);
    const legacy = getKqCarePresentation({ ...state, rulesVersion: 2, care: undefined });
    expect(legacy.latestResult?.vitalityDelta).toBeUndefined();
    expect(legacy.conditionLabel).toBe("Suivi historique");
    expect(legacy.stageCaption).toContain("santé n’a pas été enregistrée");
    expect(legacy.artwork.src).toBe(KQ_OUTCOME_ARTWORK.Enracinement.success.src);
    expect(getKqCarePresentation(startKqGame(4)).latestResult).toBeNull();
  });

  it("is deterministic and never changes the game's health, history or phase", () => {
    const state = verdict(3, "failure");
    state.care = { ...state.care!, vitality: 28, problems: [problem(3)] };
    const before = structuredClone(state);
    const first = getKqCarePresentation(state);
    expect(getKqCarePresentation(state)).toEqual(first);
    expect(state).toEqual(before);
  });
});
