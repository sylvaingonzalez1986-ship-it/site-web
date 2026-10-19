/** Harvest distinctions are versioned separately from cultivation and jury rules. */
export type KqHarvestTierContext = {
  harvestTierVersion?: 2;
  history?: readonly { outcome: "critical" | "success" | "fragile" | "failure" }[];
  /** Frozen server counts are used when a Flower no longer carries its journal. */
  successfulStages?: number;
  criticalStages?: number;
};

export const KQ_LEGENDARY_REQUIREMENTS = {
  minimumQuality: 26,
  minimumSuccessfulStages: 4,
  minimumCriticalStages: 2,
} as const;

export type KqLegendaryRequirements = typeof KQ_LEGENDARY_REQUIREMENTS & {
  qualityMet: boolean;
  successfulStagesMet: boolean;
  criticalStagesMet: boolean;
  met: boolean;
};

export const KQ_HARVEST_TIERS_LEGACY = [
  { minimumQuality: 0, name: "Récolte artisanale" },
  { minimumQuality: 6, name: "Belle pousse" },
  { minimumQuality: 10, name: "Qualité concours" },
  { minimumQuality: 14, name: "Fleur légendaire" },
] as const;

export const KQ_HARVEST_TIERS_V2 = [
  { minimumQuality: 0, name: "Récolte artisanale" },
  { minimumQuality: 8, name: "Belle pousse" },
  { minimumQuality: 14, name: "Qualité concours" },
  { minimumQuality: 20, name: "Fleur exceptionnelle" },
  { minimumQuality: 26, name: "Fleur légendaire" },
] as const;

/** Missing or invalid evidence never qualifies a Flower for the new distinction. */
export function getKqHarvestStageCounts(context: KqHarvestTierContext) {
  if (context.history) return {
    successfulStages: context.history.filter(entry => entry.outcome === "success" || entry.outcome === "critical").length,
    criticalStages: context.history.filter(entry => entry.outcome === "critical").length,
  };
  const { successfulStages, criticalStages } = context;
  const valid = Number.isInteger(successfulStages) && Number.isInteger(criticalStages)
    && successfulStages! >= 0 && successfulStages! <= 6
    && criticalStages! >= 0 && criticalStages! <= successfulStages!;
  return valid ? { successfulStages: successfulStages!, criticalStages: criticalStages! }
    : { successfulStages: null, criticalStages: null };
}

export function getKqHarvestTierProgress(quality: number, context: KqHarvestTierContext = {}) {
  const counts = getKqHarvestStageCounts(context);
  const modern = context.harvestTierVersion === 2;
  const tiers = modern ? KQ_HARVEST_TIERS_V2 : KQ_HARVEST_TIERS_LEGACY;
  const qualityMet = quality >= KQ_LEGENDARY_REQUIREMENTS.minimumQuality;
  const successfulStagesMet = counts.successfulStages !== null && counts.successfulStages >= KQ_LEGENDARY_REQUIREMENTS.minimumSuccessfulStages;
  const criticalStagesMet = counts.criticalStages !== null && counts.criticalStages >= KQ_LEGENDARY_REQUIREMENTS.minimumCriticalStages;
  const legendaryRequirements: KqLegendaryRequirements | null = modern ? {
    ...KQ_LEGENDARY_REQUIREMENTS, qualityMet, successfulStagesMet, criticalStagesMet,
    met: qualityMet && successfulStagesMet && criticalStagesMet,
  } : null;
  let tierIndex = Math.max(0, tiers.findLastIndex(tier => quality >= tier.minimumQuality));
  if (modern && tierIndex === tiers.length - 1 && !legendaryRequirements!.met) tierIndex -= 1;
  const nextTier = tiers[tierIndex + 1];
  return {
    tier: tiers[tierIndex].name,
    nextTier: nextTier?.name ?? null,
    qualityToNextTier: nextTier ? Math.max(0, nextTier.minimumQuality - quality) : 0,
    ...counts,
    legendaryRequirements,
  };
}

/** No version means the original 0/6/10/14 scale, including archived Flowers. */
export function getKqHarvestTier(quality: number, context: KqHarvestTierContext = {}) {
  return getKqHarvestTierProgress(quality, context).tier;
}
