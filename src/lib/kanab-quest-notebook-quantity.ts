/** Values are game cents; probabilities are percentages, not fractions. */
export const KQ_NOTEBOOK_QUANTITY_RULE_VERSION = "notebook-quantity-v1";
export const KQ_NOTEBOOK_QUANTITY_MAX_GRAMS = 10;

export type KqNotebookBuddieOdds = {
  common: number;
  silver: number;
  gold: number;
};

export function getKqNotebookQuantityReward(grams: number) {
  const eligibleGrams = Number.isFinite(grams) ? Math.min(KQ_NOTEBOOK_QUANTITY_MAX_GRAMS, Math.max(0, grams)) : 0;
  const multiplier = eligibleGrams >= 10 ? 1.3 : eligibleGrams >= 5 ? 1.2 : eligibleGrams >= 3 ? 1.1 : 1;
  const totalCashCents = Math.round(10_000 * eligibleGrams * multiplier);
  return {
    grams: eligibleGrams,
    totalCashCents,
    // The first 100 game euros remain part of the producer completion reward.
    bonusCashCents: Math.max(0, totalCashCents - 10_000),
  };
}

export function getKqNotebookBuddieOdds(track: "regular" | "concours", grams: number): KqNotebookBuddieOdds {
  const { grams: eligibleGrams } = getKqNotebookQuantityReward(grams);
  const multiplier = eligibleGrams >= 10 ? 2 : eligibleGrams >= 5 ? 1.5 : eligibleGrams >= 3 ? 1.25 : 1;
  const gold = (track === "concours" ? 3 : 1) * multiplier;
  const silver = track === "concours" ? 18 : 10;
  return { common: 100 - silver - gold, silver, gold };
}
