export const KQ_BUSINESS_DEVELOPMENT_CAP = 200;
export const KQ_BUSINESS_PRODUCTION_CAP = 60;
export const KQ_BUSINESS_SALES_CAP = 80;
export const KQ_BUSINESS_VALUE_CAP = 60;
export const KQ_BUSINESS_PRODUCTION_POINTS_PER_M2 = 1.2;

export type KqBusinessDevelopmentScore = {
  score: number; production: number; sales: number; companyValue: number;
  productionAreaM2: number; companyValueCents: number;
};
export type KqBusinessDevelopmentInput = {
  /** Funded, equipped culture surface, measured by the server; includes paused installations. */
  productionAreaM2?: number;
  /** Cumulative settled in-game sales, including VAT. */
  salesTtcCents?: number;
  /** Current net company assets including financial holdings, minus all outstanding debts. */
  companyValueCents?: number;
};

const nonnegative = (value = 0) => Number.isFinite(value) ? Math.max(0, value) : 0;

/** Mirrors kq_business_development_score: turnover, installed size and estimated net company value. */
export function calculateKqBusinessDevelopment(input: KqBusinessDevelopmentInput): KqBusinessDevelopmentScore {
  const productionAreaM2 = nonnegative(input.productionAreaM2);
  const companyValueCents = Number.isFinite(input.companyValueCents) ? Math.trunc(input.companyValueCents!) : 0;
  const production = Math.min(KQ_BUSINESS_PRODUCTION_CAP, Math.floor(productionAreaM2 * 6 / 5));
  const sales = Math.min(KQ_BUSINESS_SALES_CAP, Math.floor(Math.sqrt(Math.floor(nonnegative(input.salesTtcCents)) / 100) * 4 / 5));
  const companyValue = Math.min(KQ_BUSINESS_VALUE_CAP, Math.floor(Math.sqrt(Math.max(0, companyValueCents) / 100) * 3 / 5));
  return { score: production + sales + companyValue, production, sales, companyValue, productionAreaM2, companyValueCents };
}
