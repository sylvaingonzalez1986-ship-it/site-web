export type KqReputationTier = {
  code: string;
  name: string;
  minimum: number;
};

export const KQ_REPUTATION_TIERS: readonly KqReputationTier[] = [
  { code: "novice", name: "Cultivateur novice", minimum: 0 },
  { code: "steady-hand", name: "Main sûre", minimum: 20 },
  { code: "lot-artisan", name: "Artisan du lot", minimum: 60 },
  { code: "local-signature", name: "Signature locale", minimum: 150 },
  { code: "closet-master", name: "Maître du Placard", minimum: 300 },
  { code: "jury-reference", name: "Référence du jury", minimum: 600 },
] as const;

export const KQ_PLACARD_SEASON_BONUS_CAP = 150;
export const KQ_PLACARD_REPUTATION_BONUS_CAP = 100;

export type KqPlacardScoreInput = {
  rating: number;
  seasonPoints: number;
  reputation: number;
};

export function calculateKqPlacardScore(input: KqPlacardScoreInput) {
  const rating = Number.isFinite(input.rating) ? Math.max(100, Math.round(input.rating)) : 1000;
  const seasonPoints = Number.isFinite(input.seasonPoints) ? Math.max(0, Math.floor(input.seasonPoints)) : 0;
  const reputation = Number.isFinite(input.reputation) ? Math.max(0, Math.floor(input.reputation)) : 0;
  const seasonBonus = Math.min(KQ_PLACARD_SEASON_BONUS_CAP, Math.round(seasonPoints * 0.25));
  const reputationBonus = Math.min(KQ_PLACARD_REPUTATION_BONUS_CAP, Math.round(4 * Math.sqrt(reputation)));

  return {
    score: rating + seasonBonus + reputationBonus,
    rating,
    seasonPoints,
    reputation,
    seasonBonus,
    reputationBonus,
  };
}

export function getKqReputationProgress(value: number) {
  const reputation = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const currentIndex = KQ_REPUTATION_TIERS.findLastIndex((tier) => reputation >= tier.minimum);
  const tier = KQ_REPUTATION_TIERS[Math.max(0, currentIndex)];
  const nextTier = KQ_REPUTATION_TIERS[currentIndex + 1] ?? null;
  const pointsIntoTier = reputation - tier.minimum;
  const tierSpan = nextTier ? nextTier.minimum - tier.minimum : 0;
  return {
    reputation,
    tier,
    nextTier,
    pointsToNext: nextTier ? Math.max(0, nextTier.minimum - reputation) : 0,
    progressPercent: nextTier && tierSpan > 0
      ? Math.min(100, Math.floor(pointsIntoTier / tierSpan * 100))
      : 100,
  };
}

export function didKqReputationTierChange(previousValue: number, currentValue: number) {
  return getKqReputationProgress(previousValue).tier.code !== getKqReputationProgress(currentValue).tier.code;
}
