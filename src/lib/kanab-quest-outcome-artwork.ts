import { KQ_STAGES, type KqGameState, type KqOutcome, type KqStage } from "@/lib/kanab-quest-game";

export type KqOutcomeArtwork = {
  code: string;
  name: string;
  src: string;
  alt: string;
  stage: KqStage;
  outcome: KqOutcome | "dead";
};

export const KQ_OUTCOME_LABELS: Record<KqOutcome, string> = {
  critical: "Réussite exceptionnelle",
  success: "Réussite",
  fragile: "Fragile",
  failure: "Échec",
};

const stageSlugs: Record<KqStage, string> = {
  Germination: "germination",
  Enracinement: "enracinement",
  Croissance: "croissance",
  Floraison: "floraison",
  Récolte: "recolte",
  "Séchage & affinage": "sechage-affinage",
};

function artwork(stage: KqStage, outcome: KqOutcome | "dead", alt: string): KqOutcomeArtwork {
  const slug = stageSlugs[stage];
  return {
    code: `OUTCOME-${slug.toUpperCase()}-${outcome.toUpperCase()}`,
    name: `${stage} · ${outcome === "dead" ? "Culture morte" : KQ_OUTCOME_LABELS[outcome]}`,
    src: `/app/kanab-quest/reactions/stages-v3/${slug}-${outcome}.webp`,
    alt,
    stage,
    outcome,
  };
}

function stageOutcomes(stage: KqStage, subject: string): Record<KqOutcome, KqOutcomeArtwork> {
  return {
    critical: artwork(stage, "critical", `Sylvain ravi devant ${subject}, en excellent état.`),
    success: artwork(stage, "success", `Sylvain satisfait devant ${subject}, en bon état.`),
    fragile: artwork(stage, "fragile", `Sylvain vigilant devant ${subject}, fragile mais encore viable.`),
    failure: artwork(stage, "failure", `Sylvain préoccupé devant ${subject}, en difficulté mais encore viable.`),
  };
}

/** Every verdict preserves the botanical stage, including exceptional successes. */
export const KQ_OUTCOME_ARTWORK: Record<KqStage, Record<KqOutcome, KqOutcomeArtwork>> = {
  Germination: stageOutcomes("Germination", "une graine germée et sa minuscule pousse"),
  Enracinement: stageOutcomes("Enracinement", "une petite plantule et ses premières racines"),
  Croissance: stageOutcomes("Croissance", "une plante en croissance végétative, sans fleurs"),
  Floraison: stageOutcomes("Floraison", "une plante portant des fleurs"),
  Récolte: stageOutcomes("Récolte", "des fleurs mûres en cours de récolte"),
  "Séchage & affinage": stageOutcomes("Séchage & affinage", "des branches récoltées et des fleurs en cours de séchage et d’affinage"),
};

/** Two validated zero-success stages are required, so germination cannot be terminal. */
export const KQ_DEAD_CULTURE_ARTWORK: Record<Exclude<KqStage, "Germination">, KqOutcomeArtwork> = {
  Enracinement: artwork("Enracinement", "dead", "Sylvain attristé devant une petite plantule morte et ses racines desséchées."),
  Croissance: artwork("Croissance", "dead", "Sylvain attristé devant une plante végétative morte, sans fleurs."),
  Floraison: artwork("Floraison", "dead", "Sylvain attristé devant une plante fleurie morte."),
  Récolte: artwork("Récolte", "dead", "Sylvain attristé devant des fleurs de récolte perdues, posées dans un plateau."),
  "Séchage & affinage": artwork("Séchage & affinage", "dead", "Sylvain attristé devant un lot récolté perdu pendant le séchage et l’affinage."),
};

/** Stable stage / verdict order for the artwork review and production checks. */
export const KQ_OUTCOME_ARTWORK_ASSETS: readonly KqOutcomeArtwork[] = KQ_STAGES.flatMap((stage) => [
  ...Object.values(KQ_OUTCOME_ARTWORK[stage]),
  ...(stage === "Germination" ? [] : [KQ_DEAD_CULTURE_ARTWORK[stage]]),
]);

export function getKqOutcomeArtwork(state: KqGameState): KqOutcomeArtwork | null {
  if (state.phase !== "resolved" && state.phase !== "complete") return null;

  // History records the final verdict after reactions and Heritage effects.
  // The current stage and lastOutcome only support older incomplete histories.
  const resolution = state.history?.at(-1);
  const stage = resolution?.stage ?? KQ_STAGES[state.stageIndex];
  if (!stage) return null;
  if (state.cultureDead) {
    return stage === "Germination" ? null : KQ_DEAD_CULTURE_ARTWORK[stage] ?? null;
  }
  const outcome = resolution?.outcome ?? state.lastOutcome;
  return outcome ? KQ_OUTCOME_ARTWORK[stage]?.[outcome] ?? null : null;
}
