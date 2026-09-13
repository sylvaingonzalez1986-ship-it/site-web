import { KQ_REPUTATION_TIERS, getKqReputationProgress } from "./kanab-quest-reputation";
import type { KqMarketQuote, KqMarketRouteCode } from "./kanab-quest-market";

export const KQ_PRICE_POLICIES = ["clearance", "fair", "premium"] as const;
export type KqPricePolicy = (typeof KQ_PRICE_POLICIES)[number];
type KqMarketTierBenefits = {
  priceBonusPercent: number;
  demandBonus: number;
  saturationProtectionPercent: number;
  guaranteedPolicy: "fair" | "premium" | null;
};
const TIER_BENEFITS: Record<string, KqMarketTierBenefits> = {
  novice: { priceBonusPercent: 0, demandBonus: 0, saturationProtectionPercent: 0, guaranteedPolicy: null },
  "steady-hand": { priceBonusPercent: 5, demandBonus: 8, saturationProtectionPercent: 15, guaranteedPolicy: null },
  "lot-artisan": { priceBonusPercent: 12, demandBonus: 18, saturationProtectionPercent: 30, guaranteedPolicy: null },
  "local-signature": { priceBonusPercent: 20, demandBonus: 28, saturationProtectionPercent: 50, guaranteedPolicy: "fair" },
  "closet-master": { priceBonusPercent: 30, demandBonus: 40, saturationProtectionPercent: 100, guaranteedPolicy: "premium" },
  "jury-reference": { priceBonusPercent: 45, demandBonus: 55, saturationProtectionPercent: 100, guaranteedPolicy: "premium" },
};
export const KQ_MARKET_REPUTATION_TIERS = KQ_REPUTATION_TIERS.map((tier) => ({ ...tier, ...TIER_BENEFITS[tier.code] }));
export function getKqMarketReputationProgress(reputation: number) {
  const progress = getKqReputationProgress(reputation);
  return {
    ...progress,
    tier: KQ_MARKET_REPUTATION_TIERS.find((tier) => tier.code === progress.tier.code)!,
    nextTier: KQ_MARKET_REPUTATION_TIERS.find((tier) => tier.code === progress.nextTier?.code) ?? null,
  };
}

export type KqMarketContext = {
  reputation: number;
  routeSales: Partial<Record<KqMarketRouteCode, number>>;
  recentSales: Partial<Record<KqMarketRouteCode, number>>;
  marketVolumes: Partial<Record<KqMarketRouteCode, number>>;
  window: number;
};
export type KqMarketOffer = {
  policy: KqPricePolicy;
  label: string;
  payoutCents: number;
  askingPercent: number;
  accepted: boolean;
  demand: number;
  message: string;
};
export type KqMarketDemand = {
  window: number;
  expiresAt: string;
  reputation: number;
  salesCount: number;
  trend: string;
  saturation: number;
  processingCostCents: number;
  referencePayoutCents: number;
  progressionReason: string | null;
  offers: KqMarketOffer[];
};

export function getKqMarketWindow(now = Date.now()) {
  return Math.floor(now / (6 * 60 * 60 * 1000));
}

const bounded = (value: number, low: number, high: number) => Math.min(high, Math.max(low, Number.isFinite(value) ? value : low));
const HASH: KqMarketRouteCode[] = ["dry-sift", "ice-water-hash", "static-sift", "hash-signature"];
const ROSIN: KqMarketRouteCode[] = ["rosin-trial", "rosin-selection", "rosin-premium", "rosin-signature"];

// Initial processing remains open. Higher grades require an established workshop.
export function getKqRouteProgressionReason(route: KqMarketRouteCode, context: KqMarketContext) {
  const sales = (routes: KqMarketRouteCode[]) => routes.reduce((sum, code) => sum + bounded(context.routeSales[code] ?? 0, 0, 100000), 0);
  const rules: Partial<Record<KqMarketRouteCode, [number, number, KqMarketRouteCode[]]>> = {
    "ice-water-hash": [8, 2, HASH],
    "rosin-selection": [12, 3, ROSIN],
    "rosin-premium": [35, 6, ROSIN],
    "static-sift": [45, 7, HASH],
    "rosin-signature": [85, 12, ROSIN],
    "hash-signature": [85, 12, HASH],
  };
  const rule = rules[route];
  if (!rule) return null;
  const [reputation, count, family] = rule;
  const missing = [
    context.reputation < reputation ? `${Math.max(0, context.reputation)}/${reputation} réputation` : null,
    sales(family) < count ? `${sales(family)}/${count} ventes en filière ${family === HASH ? "hash" : "rosin"}` : null,
  ].filter(Boolean);
  return missing.length ? `Atelier à développer : ${missing.join(" · ")}.` : null;
}

export function applyKqMarketDemand(quote: KqMarketQuote, juryScore: number, context: KqMarketContext): KqMarketQuote {
  const familyIndex = quote.family === "flower" ? 0 : quote.family === "hash" ? 1 : 2;
  const rotation = ((context.window % 6) + 6) % 6;
  const trendBonus = rotation % 3 === familyIndex ? 14 : (rotation + 1) % 3 === familyIndex ? -10 : 0;
  const ownSales = bounded(context.recentSales[quote.route] ?? 0, 0, 100);
  const totalVolume = Object.values(context.marketVolumes).reduce((sum, value) => sum + bounded(value ?? 0, 0, 1e9), 0);
  const share = totalVolume >= 8 ? bounded(context.marketVolumes[quote.route] ?? 0, 0, totalVolume) / totalVolume : 0;
  const saturation = Math.round(bounded(ownSales * 9 + Math.max(0, share - 0.3) * 45, 0, 45));
  const { reputation, tier } = getKqMarketReputationProgress(context.reputation);
  const effectiveSaturation = saturation * (1 - tier.saturationProtectionPercent / 100);
  const quality = bounded(juryScore, 0, 10);
  const prestige = quote.route.includes("signature") ? 20 : quote.route === "static-sift" || quote.route === "rosin-premium" ? 12 : 0;
  const appetite = bounded(48 + (quality - 6) * 12 + tier.demandBonus + trendBonus - effectiveSaturation - prestige, 5, 100);
  const salvage = quote.family === "salvage";
  const processing = quote.family === "hash" || quote.family === "rosin";
  const processingCostCents = processing ? Math.round(quote.processedInputGrams * (prestige ? 32 : 18)) : 0;
  // Established premium clientele protects the neutral price as well as buying the lot.
  // Quality still determines the underlying value; fees are deducted after the tier bonus.
  const marketFactor = bounded(0.85 + trendBonus / 200 - effectiveSaturation / 180, tier.guaranteedPolicy === "premium" ? 0.85 : 0.5, 1.2);
  const referencePayoutCents = Math.max(0, Math.round(quote.payoutCents * (salvage ? 1 : marketFactor * (1 + tier.priceBonusPercent / 100)) - processingCostCents));
  const requiredLevels: Partial<Record<KqMarketRouteCode, number>> = { "ice-water-hash": 2, "rosin-selection": 3, "rosin-premium": 6, "static-sift": 6, "rosin-signature": 9, "hash-signature": 9 };
  const requiredLevel = requiredLevels[quote.route] ?? 1;
  const levelReason = (quote.processingLevel ?? 1) < requiredLevel ? `Machines de la filière : niveau ${quote.processingLevel ?? 1}/${requiredLevel} requis.` : null;
  const progressionReason = [getKqRouteProgressionReason(quote.route, context), levelReason].filter(Boolean).join(" ") || null;
  const offers = KQ_PRICE_POLICIES.map((policy): KqMarketOffer => {
    const askingPercent = salvage ? 100 : policy === "clearance" ? 68 : policy === "premium" ? 122 : 100;
    const demand = salvage ? 100 : Math.round(bounded(appetite + (policy === "clearance" ? 40 : policy === "premium" ? -24 : 0), 0, 100));
    // A discounted wholesaler is always a way out, including in a saturated market.
    const loyalBuyer = !salvage && (tier.guaranteedPolicy === "premium" || (tier.guaranteedPolicy === "fair" && policy === "fair"));
    const accepted = !progressionReason && quote.available && (salvage || policy === "clearance" || loyalBuyer || demand >= 48);
    const message = progressionReason ?? (!quote.available ? quote.blockedReason ?? "Filière indisponible." : salvage
      ? "Reprise de secours, sans réputation."
      : policy === "clearance" ? "Le grossiste reprend le lot avec une remise ; marge réduite."
      : loyalBuyer ? tier.guaranteedPolicy === "premium"
        ? "Ta clientèle fidèle garantit ce prix ; la saturation et les tendances défavorables ne le font plus baisser."
        : "Ta clientèle fidèle garantit la vente au prix du marché, même en période de saturation."
      : accepted ? demand >= 80 ? "Les acheteurs s’arrachent ce lot à ce prix." : "Un acheteur accepte ce prix."
      : saturation >= 18 ? "Marché saturé : baisse ton prix ou conserve le lot pour un prochain marché."
      : quality < 7 ? "La qualité ne convainc pas à ce tarif : les acheteurs demandent une remise."
      : "La clientèle hésite à ce tarif : développe ta réputation, baisse le prix ou attends.");
    return { policy, label: policy === "clearance" ? "Prix de déstockage" : policy === "premium" ? "Prix ambitieux" : "Prix du marché", askingPercent, payoutCents: Math.round(referencePayoutCents * askingPercent / 100), accepted, demand, message };
  });
  const fair = offers[1];
  return {
    ...quote,
    available: quote.available && !progressionReason,
    blockedReason: quote.blockedReason ?? progressionReason,
    payoutCents: fair.payoutCents,
    reputationGain: progressionReason ? 0 : quote.reputationGain,
    market: { window: context.window, expiresAt: new Date((context.window + 1) * 6 * 60 * 60 * 1000).toISOString(), reputation, salesCount: Object.values(context.routeSales).reduce((sum, count) => sum + (count ?? 0), 0), trend: salvage ? "Reprise stable" : trendBonus > 0 ? "Filière recherchée" : trendBonus < 0 ? "Demande en retrait" : "Demande régulière", saturation, processingCostCents, referencePayoutCents, progressionReason, offers },
  };
}

export function selectKqMarketOffer(quote: KqMarketQuote, policy: KqPricePolicy): KqMarketQuote {
  const offer = quote.market?.offers.find((candidate) => candidate.policy === policy);
  return offer ? { ...quote, payoutCents: offer.payoutCents, pricePolicy: policy } : quote;
}
