export const KQ_BUSINESS_PRODUCTION_WEIGHT = 27;
export const KQ_BUSINESS_SALES_WEIGHT = 36;
export const KQ_BUSINESS_REPUTATION_WEIGHT = 27;
export const KQ_BUSINESS_AREA_REFERENCE_M2 = 50;
export const KQ_BUSINESS_SALES_REFERENCE_CENTS = 1_000_000;
export const KQ_BUSINESS_REPUTATION_REFERENCE = 600;
export const KQ_BUSINESS_AREA_WINDOW_DAYS = 30;

export type KqBusinessDevelopmentScore = {
  score: number; production: number; sales: number; reputation: number;
  productionAreaM2: number; salesHtCents: number; reputationPoints: number;
};
export type KqBusinessDevelopmentInput = {
  /** Actual cultivated surface averaged over the trailing 30 days, from frozen run snapshots. */
  productionAreaM2?: number;
  /** Settled in-game turnover excluding VAT during the ranking season, in cents. */
  salesHtCents?: number;
  /** Current commercial reputation, including losses. */
  reputationPoints?: number;
};

const nonnegative = (value = 0) => Number.isFinite(value) ? Math.max(0, value) : 0;
const tenth = (value: number) => Math.round(value * 10) / 10;

/** Mirrors kq_business_development_score_for_season; rounded displayed components are summed. */
export function calculateKqBusinessDevelopment(input: KqBusinessDevelopmentInput): KqBusinessDevelopmentScore {
  const productionAreaM2 = nonnegative(input.productionAreaM2);
  const salesHtCents = Math.floor(nonnegative(input.salesHtCents));
  const reputationPoints = Math.floor(nonnegative(input.reputationPoints));
  const production = tenth(KQ_BUSINESS_PRODUCTION_WEIGHT * Math.log2(1 + productionAreaM2 / KQ_BUSINESS_AREA_REFERENCE_M2));
  const sales = tenth(KQ_BUSINESS_SALES_WEIGHT * Math.log2(1 + salesHtCents / KQ_BUSINESS_SALES_REFERENCE_CENTS));
  const reputation = tenth(KQ_BUSINESS_REPUTATION_WEIGHT * Math.log2(1 + reputationPoints / KQ_BUSINESS_REPUTATION_REFERENCE));
  return { score: tenth(production + sales + reputation), production, sales, reputation, productionAreaM2, salesHtCents, reputationPoints };
}
