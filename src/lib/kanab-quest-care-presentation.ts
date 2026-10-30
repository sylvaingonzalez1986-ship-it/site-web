import { getKqStageDisplayName, KQ_STAGES, type KqGameState, type KqOutcome, type KqStage } from "./kanab-quest-game";
import { KQ_DEAD_CULTURE_ARTWORK, KQ_OUTCOME_ARTWORK, KQ_OUTCOME_LABELS } from "./kanab-quest-outcome-artwork";

export type KqCarePresentation = {
  stage: KqStage;
  stageIndex: number;
  stageLabel: string;
  artwork: { src: string; alt: string };
  condition: "healthy" | "watch" | "critical" | "dead" | "harvested";
  conditionLabel: string;
  stageCaption: string;
  latestResult: { stageLabel: string; outcome: KqOutcome; label: string; vitalityDelta?: number } | null;
};

const STAGE_ARTWORK: Record<KqStage, { src: string; alt: string }> = {
  Germination: { src: "/app/kanab-quest/stages/sylvain-germination-v1.webp", alt: "Sylvain place une graine germée dans son support de culture." },
  Enracinement: { src: "/app/kanab-quest/stages/sylvain-enracinement-v1.webp", alt: "Sylvain accompagne un jeune plant et ses premières racines." },
  Croissance: { src: "/app/kanab-quest/stages/sylvain-croissance-v1.webp", alt: "Sylvain guide les branches du plant pendant sa croissance." },
  Floraison: { src: "/app/kanab-quest/stages/sylvain-floraison-v1.webp", alt: "Sylvain inspecte les fleurs et règle la ventilation." },
  Récolte: { src: "/app/kanab-quest/stages/sylvain-recolte-v1.webp", alt: "Sylvain récolte les fleurs arrivées à maturité." },
  "Séchage & affinage": { src: "/app/kanab-quest/stages/sylvain-sechage-affinage-v1.webp", alt: "Sylvain contrôle le séchage de sa récolte avant le jury." },
};

const STAGE_CAPTIONS: Record<KqStage, string> = {
  Germination: "Une graine, une jeune pousse : ta culture démarre.",
  Enracinement: "Les premières racines s’installent dans le sol.",
  Croissance: "La plante développe ses feuilles et ses branches.",
  Floraison: "Les fleurs se développent : le suivi continue.",
  Récolte: "Les fleurs arrivent à la récolte. Leur état compte pour la suite.",
  "Séchage & affinage": "Le lot sèche. La santé affichée conserve le bilan à la récolte.",
};

/** Selects existing illustrations only. Neither a die result nor a warning
 * changes the botanical stage, the recorded outcome, or the culture's health. */
export function getKqCarePresentation(state: KqGameState): KqCarePresentation {
  const receipt = state.history.at(-1);
  const receiptStage = receipt && KQ_STAGES.includes(receipt.stage) ? receipt.stage : undefined;
  const atVerdict = state.phase === "resolved" || state.phase === "complete";
  // An explicit terminal loss uses its actual final stage, even if a historical
  // save has a later cursor. Preparing the next step always uses its new stage.
  const stage = ((atVerdict || state.cultureDead) ? receiptStage : undefined)
    ?? KQ_STAGES[state.stageIndex] ?? receiptStage ?? KQ_STAGES[0];
  const stageIndex = KQ_STAGES.indexOf(stage);
  const stageLabel = getKqStageDisplayName(stage);
  const resolution = receiptStage ? state.care?.history.findLast(event => event.kind === "resolution"
    && event.stageIndex === KQ_STAGES.indexOf(receiptStage)) : undefined;
  const latestResult: KqCarePresentation["latestResult"] = receipt && receiptStage ? {
    stageLabel: getKqStageDisplayName(receiptStage), outcome: receipt.outcome, label: KQ_OUTCOME_LABELS[receipt.outcome],
    ...(resolution ? { vitalityDelta: resolution.vitalityDelta } : {}),
  } : null;

  const severity = Math.max(0, ...(state.care?.problems.map(problem => problem.severity) ?? []));
  const vitality = state.care?.vitality;
  const healthCritical = vitality !== undefined && vitality <= 30;
  const healthFragile = vitality !== undefined && vitality <= 60;
  const critical = healthCritical || severity === 3;
  const watch = healthFragile || severity > 0;
  const harvested = stageIndex >= 5;
  const condition: KqCarePresentation["condition"] = state.cultureDead ? "dead"
    : harvested ? "harvested" : critical ? "critical" : watch ? "watch" : "healthy";
  const conditionLabel = condition === "dead" ? "Culture arrêtée"
    : condition === "harvested" ? "Lot récolté"
      : condition === "critical" ? healthCritical ? "Santé critique" : "Alerte critique"
        : condition === "watch" ? "À surveiller"
          : state.care ? "En forme" : "Suivi historique";

  const currentOutcome = atVerdict && receiptStage === stage ? receipt?.outcome
    : atVerdict && !receipt ? state.lastOutcome ?? undefined : undefined;
  // A concerning overall state must remain visible after a successful move.
  // An ordinary failure remains viable and never selects a death illustration.
  const picturedOutcome: KqOutcome | undefined = critical ? "failure"
    : watch ? currentOutcome === "failure" ? "failure" : "fragile" : currentOutcome;
  let artwork = picturedOutcome ? KQ_OUTCOME_ARTWORK[stage][picturedOutcome] : STAGE_ARTWORK[stage];
  if (state.cultureDead) {
    // No valid game can end in germination. Preserve that stage for incomplete
    // historical data instead of inventing a missing asset or an older plant.
    artwork = stage === "Germination" ? KQ_OUTCOME_ARTWORK.Germination.failure : KQ_DEAD_CULTURE_ARTWORK[stage];
  }

  let stageCaption = STAGE_CAPTIONS[stage];
  if (state.cultureDead) stageCaption = "La culture s’est arrêtée à cette étape. Son suivi reste consultable.";
  else if (!state.care) stageCaption = `${harvested ? "Le lot est récolté." : STAGE_CAPTIONS[stage]} La santé n’a pas été enregistrée pour cette culture.`;
  else if (harvested) stageCaption = state.phase === "complete"
    ? "Le lot est récolté et séché. La santé conserve le bilan à la récolte ; l’affinage vient avant le jury et la vente."
    : STAGE_CAPTIONS[stage];
  else if (critical) stageCaption += healthCritical ? " La santé est basse : la culture est en difficulté."
    : " Un problème actif a atteint le niveau critique.";
  else if (watch) stageCaption += healthFragile && severity > 0 ? " La santé et les problèmes actifs restent à surveiller."
    : healthFragile ? " La santé reste fragilisée." : " Un problème actif demande un suivi.";

  return { stage, stageIndex, stageLabel, artwork: { src: artwork.src, alt: artwork.alt }, condition, conditionLabel, stageCaption, latestResult };
}
