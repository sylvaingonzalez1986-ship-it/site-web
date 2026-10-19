import type { KqRunProjection } from "@/lib/kanab-quest-game";

type TierProgress = Pick<KqRunProjection, "nextTier" | "qualityToNextTier" | "successfulStages" | "criticalStages" | "legendaryRequirements" | "remainingStages">;

/** Keep the remaining performance conditions visible even after reaching 26 points. */
export function KqHarvestTierProgress({ projection }: { projection: TierProgress }) {
  const { nextTier, qualityToNextTier, legendaryRequirements: requirements } = projection;
  if (!nextTier) return <>Palier maximal atteint.</>;
  const finished = projection.remainingStages === 0;
  const showRequirements = nextTier === "Fleur légendaire" && requirements !== null;
  const missingSuccesses = showRequirements ? Math.max(0, requirements.minimumSuccessfulStages - projection.successfulStages) : 0;
  const missingCriticals = showRequirements ? Math.max(0, requirements.minimumCriticalStages - projection.criticalStages) : 0;
  return <>
    <strong>{finished ? `Culture terminée : palier ${nextTier} non atteint.` : `Prochain palier : ${nextTier}.`}</strong>{" "}
    {qualityToNextTier > 0
      ? `${finished ? "Il manquait" : "Encore"} ${qualityToNextTier} point${qualityToNextTier > 1 ? "s" : ""} de Qualité.`
      : "Qualité requise atteinte."}
    {showRequirements ? <>
      <br />
      Étapes réussies : {projection.successfulStages}/{requirements.minimumSuccessfulStages}{missingSuccesses > 0 ? ` (${finished ? "il manquait" : "encore"} ${missingSuccesses})` : " (atteint)"}.
      {" "}Critiques : {projection.criticalStages}/{requirements.minimumCriticalStages}{missingCriticals > 0 ? ` (${finished ? "il manquait" : "encore"} ${missingCriticals})` : " (atteint)"}.
      {" "}Une étape critique compte aussi comme réussie.
    </> : null}
  </>;
}
