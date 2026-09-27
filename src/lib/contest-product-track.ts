export type ContestProductPricing = {
  category?: string;
  price?: number;
  originalPrice?: number;
  promoPercent?: number;
  weightGrams?: number;
  isPack?: boolean;
  variantOptions?: unknown[];
};

export type ContestProductTrackClassification =
  | { status: "eligible"; track: "regular" | "concours"; pricePerGramCents: number }
  | { status: "ineligible"; track: null; pricePerGramCents: number | null }
  | { status: "unknown"; track: null; pricePerGramCents: null };

function isPositiveFinite(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** Classifies flowers from their reference tax-inclusive price, independently of stock or order discounts. */
export function classifyContestProductTrack(product: ContestProductPricing): ContestProductTrackClassification {
  if (product.category !== "fleurs" || product.isPack) {
    return { status: "ineligible", track: null, pricePerGramCents: null };
  }
  if (!isPositiveFinite(product.price) || !isPositiveFinite(product.weightGrams) || product.variantOptions?.length) {
    return { status: "unknown", track: null, pricePerGramCents: null };
  }

  const referencePrice = isPositiveFinite(product.originalPrice) && product.originalPrice > product.price
    ? product.originalPrice : product.price;
  const pricePerGramCents = Math.round((referencePrice / product.weightGrams + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(pricePerGramCents)) {
    return { status: "unknown", track: null, pricePerGramCents: null };
  }
  if (pricePerGramCents < 250) {
    return { status: "ineligible", track: null, pricePerGramCents };
  }
  return { status: "eligible", track: pricePerGramCents === 250 ? "regular" : "concours", pricePerGramCents };
}
