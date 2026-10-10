import { describe, expect, it } from "vitest";
import { advanceKqStage, resolveKqStage, startKqGame, type KqGameState } from "./kanab-quest-game";
import { applyKqCareProduct, createKqCareState, performKqBasicCare, type KqCareProblem } from "./kanab-quest-care";
import { getKqCultureAnalysis } from "./kanab-quest-culture-analysis";
import { getKqCultureStory } from "./kanab-quest-culture-story";

const finish = (state: KqGameState, dice: [number, number, number] = [6, 6, 6]) => resolveKqStage({ ...state, phase: "rolled", dice });
const problem = (code: string, severity: 1 | 2 | 3 = 3): KqCareProblem => ({ code, severity, status: "confirmed", trend: "stable", appearedAt: 0, variant: 0 });
function begin(): KqGameState {
  const state = startKqGame(9);
  state.situationCodes = ["SIT-001", "SIT-008", "SIT-003", "SIT-004", "SIT-005", "SIT-006"];
  state.care = createKqCareState();
  return state;
}
function positionAt(index: number) {
  let state = begin();
  while (state.stageIndex < index) state = advanceKqStage(finish(state));
  return state;
}
const storyOf = (state: KqGameState) => getKqCultureStory(state, getKqCultureAnalysis(state));

describe("personalized culture stories", () => {
  it("uses actual stages and nonzero effects without changing the saved culture", () => {
    let state = begin();
    while (state.phase !== "complete") state = advanceKqStage(finish(state, state.stageIndex === 1 ? [2, 2, 2] : [6, 6, 6]));
    const before = structuredClone(state);
    const story = storyOf(state);
    expect(story.stages).toHaveLength(6);
    expect(story.title).toBe("Un enracinement mouvementé");
    expect(story.summary).toContain("« Réserve irrégulière » s’est soldée par un échec à l’enracinement");
    expect(story.summary).toContain("réussi « Lot encore humide » au séchage");
    expect(story.summary).toContain("Récolte obtenue");
    expect(story.summary).not.toContain("étapes réussies sur");
    expect(story.stages[5].stage).toBe("Séchage");
    expect(story.moments.some(moment => moment.kind === "setback" && moment.stageIndex === 1)).toBe(true);
    expect(story.moments.some(moment => moment.kind === "success")).toBe(true);
    expect(story.stages[1].effects.some(effect => effect === "−1 point de qualité.")).toBe(true);
    expect(story.moments.length).toBeLessThanOrEqual(3);
    expect(JSON.stringify(story)).not.toMatch(/fidélité|\+0\b/i);
    expect(state).toEqual(before);
    expect(storyOf(state)).toEqual(story);
  });

  it("does not invent old rewards, interventions or biological measurements", () => {
    const state = finish(startKqGame(7, { rulesVersion: 2 }));
    delete state.history[0].decision;
    delete state.history[0].qualityDelta;
    delete state.history[0].xpGain;
    const story = storyOf(state);
    expect(story.stages[0].detailsAvailable).toBe(false);
    expect(story.stages[0].effects).toEqual([]);
    expect(story.care).toEqual([]);
    expect(story.notes).toHaveLength(1);
    expect(JSON.stringify(story)).not.toMatch(/cannabinoïde|Santé|%/);
  });

  it("reports a purchased input without inventing a benefit from its application", () => {
    let state = begin();
    state = applyKqCareProduct(state, "CARE-ORGANIC-FEED");
    state = finish(state);
    const story = storyOf(state);
    expect(story.care).toEqual([expect.objectContaining({
      code: "CARE-ORGANIC-FEED", count: 1, stages: ["Germination"],
      detail: "Germination : soutien non activé, aucune situation compatible.",
    })]);
    expect(story.stages[0].careActions).toContain("Engrais organique");
    expect(story.stages[0].effects.join(" ")).not.toContain("Soutien à la production");
  });

  it.each(["historical", "current"])("recognizes %s basic care without inventing a payment receipt", generation => {
    const prepared = performKqBasicCare(begin());
    if (generation === "historical") prepared.care!.history.at(-1)!.message = "Suivi de base engagé : surveillance et entretien, sans achat.";
    const state = finish(prepared);
    const before = structuredClone(state);
    const story = storyOf(state);
    expect(story.stages[0].careActions).toEqual(["Entretien de base"]);
    expect(story.care).toEqual([]);
    expect(story.stages[0].careActions.join(" ")).not.toMatch(/gratuit|payé|€/i);
    expect(state).toEqual(before);
  });

  it("describes the actual two-step PBI follow-up rather than claiming it caused all health changes", () => {
    let state = positionAt(2);
    state.care = { ...state.care!, problems: [problem("APHIDS")] };
    state = applyKqCareProduct(state, "CARE-APHIDIUS");
    state = advanceKqStage(finish(state, [2, 2, 2]));
    state = finish(state, [2, 2, 2]);
    const story = storyOf(state);
    expect(story.care[0].detail).toContain("Foyer de pucerons : recul de 2 niveaux au bilan");
    expect(story.stages[3].effects).toContain("Foyer de pucerons : critique → léger.");
    expect(story.stages[2].careActions).toContain("Aphidius colemani");
    expect(story.care[0].detail).not.toContain("Santé");
  });

  it("does not call the postharvest clearing of plant problems a cure", () => {
    let state = positionAt(5);
    state.care = { ...state.care!, problems: [problem("APHIDS")] };
    state = finish(state);
    expect(state.care!.problems).toEqual([]);
    expect(storyOf(state).stages[5].effects.join(" ")).not.toMatch(/résorbé|pucerons/i);
  });

  it("distinguishes a first-culture rescue from a terminal culture loss", () => {
    const initial = begin();
    initial.firstCultureRescue = true;
    initial.care!.vitality = 5;
    const saved = finish(initial, [2, 2, 2]);
    const rescued = storyOf(saved);
    expect(saved.history[0].rescued).toBe(true);
    expect(rescued.stages[0].effects.join(" ")).toContain("15/100");
    expect(rescued.moments.find(moment => moment.kind === "care")?.text).toContain("n’ont pas été effacées");
    expect(rescued.title).not.toContain("arrêté");

    const dead = finish(advanceKqStage(saved), [2, 2, 2]);
    const stopped = storyOf(dead);
    expect(dead.cultureDead).toBe(true);
    expect(stopped.stages).toHaveLength(2);
    expect(stopped.title).toBe("Arrêt à l’enracinement");
    expect(stopped.summary).toContain("arrêtée à l’enracinement, sans récolte");
    expect(stopped.moments[0].text).toContain("n’a pas produit de récolte");
    expect(stopped.stages[1].summary).toContain("arrêtée ici");
  });

  it("separates a theft loss from health, terpenes and cannabinoid development", () => {
    const position = positionAt(4);
    position.situationCodes[4] = "SIT-027";
    position.care = createKqCareState();
    const story = storyOf(finish(position, [2, 2, 2]));
    const effects = story.stages[4].effects.join(" ");
    expect(effects).toContain("Le vol a retiré");
    expect(effects).not.toMatch(/Santé|terpènes|cannabinoïde/);
  });

  it("does not present missing steps or counterfeit advice as facts", () => {
    const initial = begin();
    const empty = storyOf(initial);
    expect(empty.stages).toEqual([]);
    expect(empty.moments).toEqual([]);
    const state = finish(initial);
    const analysis = getKqCultureAnalysis(state);
    const story = getKqCultureStory(state, { ...analysis, advice: [] });
    expect(story.stages).toHaveLength(1);
    expect(story.summary).toContain("à la germination");
    expect(JSON.stringify(story)).not.toContain("stock");
  });

  it("does not mistake a fresh outbreak for the preceding problem persisting", () => {
    let state = begin();
    state.situationCodes[0] = "SIT-017";
    state.situationCodes[1] = "SIT-018";
    state.care!.problems = [problem("ROOTS", 1)];
    state = finish(state);
    expect(state.care!.problems).toEqual([]);
    state = advanceKqStage(state);
    expect(state.care!.problems).toContainEqual(expect.objectContaining({ code: "ROOTS", appearedAt: 1 }));
    state = finish(state);
    const story = storyOf(state);
    expect(story.stages[0].detailsAvailable).toBe(true);
    expect(story.stages[1].detailsAvailable).toBe(true);
    expect(story.stages[0].effects).toContain("Stress racinaire : résorbé au bilan.");
  });

  it("keeps existing trait punctuation without adding another full stop", () => {
    const state = finish(begin());
    state.history[0].trait = "Départ bien aéré.";
    delete state.history[0].qualityDelta;
    const story = storyOf(state);
    expect(story.stages[0].summary).toContain("Bilan : départ bien aéré.");
    expect(story.moments[0].text).toContain("Départ bien aéré.");
    expect(JSON.stringify(story)).not.toContain("..");
  });
});
