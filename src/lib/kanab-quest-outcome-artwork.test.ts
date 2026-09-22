import { describe, expect, it } from "vitest";
import {
  activateKqHeritage, advanceKqStage, KQ_STAGES, playKqCard, previewKqResolution,
  resolveKqStage, startKqGame, type KqGameState, type KqOutcome,
} from "@/lib/kanab-quest-game";
import { encodeKqSave, parseKqGameSave } from "@/lib/kanab-quest-persistence";
import {
  getKqOutcomeArtwork, KQ_DEAD_CULTURE_ARTWORK, KQ_OUTCOME_ARTWORK,
  KQ_OUTCOME_ARTWORK_ASSETS,
} from "@/lib/kanab-quest-outcome-artwork";

const outcomes: KqOutcome[] = ["critical", "success", "fragile", "failure"];
const resolveDice = (state: KqGameState, dice: [number, number, number]) =>
  resolveKqStage({ ...state, phase: "rolled", dice });

function prepareStage(stageIndex: number, initial = startKqGame(330)) {
  let state = initial;
  while (state.stageIndex < stageIndex) state = advanceKqStage(resolveDice(state, [4, 5, 6]));
  return state;
}

describe("stage-aware culture outcome artwork", () => {
  it("covers 24 stage verdicts and only the five reachable terminal stages", () => {
    expect(Object.keys(KQ_OUTCOME_ARTWORK)).toEqual(KQ_STAGES);
    expect(Object.keys(KQ_DEAD_CULTURE_ARTWORK)).toEqual(KQ_STAGES.slice(1));
    expect(KQ_OUTCOME_ARTWORK_ASSETS).toHaveLength(29);
    expect(new Set(KQ_OUTCOME_ARTWORK_ASSETS.map((asset) => asset.code)).size).toBe(29);
    expect(new Set(KQ_OUTCOME_ARTWORK_ASSETS.map((asset) => asset.src)).size).toBe(29);
  });

  it.each(KQ_STAGES.flatMap((stage, stageIndex) => outcomes.map((outcome) => ({ stage, stageIndex, outcome }))))(
    "keeps $stage when the final verdict is $outcome",
    ({ stage, stageIndex, outcome }) => {
      const state = resolveDice(prepareStage(stageIndex), [4, 5, 6]);
      const history = state.history.map((entry, index) => index === stageIndex ? { ...entry, outcome } : entry);
      expect(getKqOutcomeArtwork({ ...state, history })).toMatchObject({ stage, outcome });
    },
  );

  it("uses the validated history even if the stage cursor and cached verdict differ", () => {
    const germinated = resolveDice(startKqGame(331), [6, 6, 6]);
    expect(getKqOutcomeArtwork({ ...germinated, stageIndex: 3, lastOutcome: "failure" }))
      .toBe(KQ_OUTCOME_ARTWORK.Germination.critical);
  });

  it("does not reuse the preceding verdict while preparing or rolling the next stage", () => {
    const resolved = resolveDice(startKqGame(332), [4, 5, 6]);
    expect(getKqOutcomeArtwork(resolved)?.stage).toBe("Germination");
    const next = advanceKqStage(resolved);
    expect(getKqOutcomeArtwork(next)).toBeNull();
    expect(getKqOutcomeArtwork({ ...next, phase: "rolled", dice: [6, 6, 6] })).toBeNull();
    expect(getKqOutcomeArtwork(resolveDice(next, [4, 5, 6]))?.stage).toBe("Enracinement");
  });

  it.each([{ stageIndex: 2, situationCode: "SIT-009" }, { stageIndex: 3, situationCode: "SIT-023" }])(
    "keeps the botanical stage when Palissage doux is used at index $stageIndex",
    ({ stageIndex, situationCode }) => {
      const base = prepareStage(stageIndex, startKqGame(333, { deckCodes: ["BOTTE-015"], startingXp: 9 }));
      const state = {
        ...base,
        handCodes: ["BOTTE-015"],
        situationCodes: base.situationCodes.map((code, index) => index === stageIndex ? situationCode : code),
      };
      const played = playKqCard(state, "BOTTE-015");
      expect(played.playedThisStage).toContain("BOTTE-015");
      expect(getKqOutcomeArtwork(resolveDice(played, [4, 5, 6])))
        .toMatchObject({ stage: KQ_STAGES[stageIndex], outcome: "critical" });
    },
  );

  it("waits for a reaction and then uses its validated result", () => {
    const base = startKqGame(334, { heritageCard: {
      code: "HERITAGE-900", name: "Étincelle de secours", timing: "once-per-run", effect: "neutral-to-spark",
      description: "Transforme un neutre en Étincelle.", producerName: "Test",
    } });
    const rolled: KqGameState = { ...base, phase: "rolled", dice: [2, 2, 3] };
    expect(previewKqResolution(rolled)?.total).toBe(0);
    expect(getKqOutcomeArtwork(rolled)).toBeNull();
    const resolved = resolveKqStage(activateKqHeritage(rolled));
    expect(resolved.history.at(-1)?.total).toBe(1);
    expect(getKqOutcomeArtwork(resolved)?.outcome).toBe(resolved.history.at(-1)?.outcome);
  });

  it("uses a passive Heritage's final outcome rather than its preview", () => {
    const base = startKqGame(335, { heritageCard: {
      code: "HERITAGE-900", name: "Reprise vigoureuse", timing: "passive", effect: "failure-to-fragile",
      description: "Le premier échec devient fragile.", producerName: "Test",
    } });
    const rolled: KqGameState = { ...base, phase: "rolled", dice: [2, 2, 3] };
    expect(previewKqResolution(rolled)?.outcome).toBe("failure");
    const resolved = resolveKqStage(rolled);
    expect(getKqOutcomeArtwork(resolved)).toBe(KQ_OUTCOME_ARTWORK.Germination.fragile);
  });

  it("keeps the first zero nonterminal and prioritizes death on the second zero", () => {
    const firstZero = resolveDice(startKqGame(336), [2, 2, 3]);
    expect(getKqOutcomeArtwork(firstZero)).toBe(KQ_OUTCOME_ARTWORK.Germination.failure);
    const dead = resolveDice(advanceKqStage(firstZero), [2, 2, 3]);
    expect(getKqOutcomeArtwork(dead)).toBe(KQ_DEAD_CULTURE_ARTWORK.Enracinement);
    const recoveredVerdict = {
      ...dead,
      lastOutcome: "fragile" as const,
      history: dead.history.map((entry) => ({ ...entry, outcome: "fragile" as const })),
    };
    expect(getKqOutcomeArtwork(recoveredVerdict)).toBe(KQ_DEAD_CULTURE_ARTWORK.Enracinement);
  });

  it("retains the harvested drying stage for a completed run or a lost final lot", () => {
    const dried = advanceKqStage(resolveDice(prepareStage(5), [4, 5, 6]));
    expect(getKqOutcomeArtwork(dried)).toBe(KQ_OUTCOME_ARTWORK["Séchage & affinage"].critical);
    const firstZero = resolveDice(startKqGame(337), [2, 2, 3]);
    const lost = resolveDice(prepareStage(5, advanceKqStage(firstZero)), [2, 2, 3]);
    expect(getKqOutcomeArtwork(lost)).toBe(KQ_DEAD_CULTURE_ARTWORK["Séchage & affinage"]);
  });

  it.each([false, true])("restores the same illustration after saving, terminal: %s", (terminal) => {
    const first = resolveDice(startKqGame(338), [2, 2, 3]);
    const state = terminal ? resolveDice(advanceKqStage(first), [2, 2, 3]) : first;
    const restored = parseKqGameSave(encodeKqSave(state));
    expect(restored).not.toBeNull();
    expect(getKqOutcomeArtwork(restored!)).toEqual(getKqOutcomeArtwork(state));
  });

  it("keeps a legacy fallback at its current stage and never invents germination death", () => {
    const legacy: KqGameState = { ...startKqGame(339), phase: "resolved", stageIndex: 2, lastOutcome: "success" };
    expect(getKqOutcomeArtwork(legacy)).toBe(KQ_OUTCOME_ARTWORK.Croissance.success);
    expect(getKqOutcomeArtwork({ ...legacy, phase: "complete", cultureDead: true }))
      .toBe(KQ_DEAD_CULTURE_ARTWORK.Croissance);
    expect(getKqOutcomeArtwork({ ...legacy, phase: "complete", cultureDead: true, stageIndex: 0 })).toBeNull();
    expect(getKqOutcomeArtwork({ ...legacy, lastOutcome: null })).toBeNull();
    expect(getKqOutcomeArtwork({ ...legacy, stageIndex: 6 })).toBeNull();
  });
});
