import type { KqMarketRouteCode } from "./kanab-quest-market";

/** Game economy. Prices are final virtual cents; rates mirror kq_online_* SQL. */
export const KQ_ONLINE_FEE_PERCENT = 2.5;
export const KQ_ONLINE_PACKAGING = [
  { code: "kraft-5", family: "kraft", formatGrams: 5, name: "Kraft artisanal · 5 g", unitCostCents: 25, image: "/placard/packaging-kraft-v1.webp", protectionRate: 1, satisfactionBonus: 0, requiresBranding: false },
  { code: "kraft-10", family: "kraft", formatGrams: 10, name: "Kraft artisanal · 10 g", unitCostCents: 30, image: "/placard/packaging-kraft-v1.webp", protectionRate: 1, satisfactionBonus: 0, requiresBranding: false },
  { code: "printed-5", family: "printed", formatGrams: 5, name: "Doypack à ta marque · 5 g", unitCostCents: 110, image: "/placard/packaging-printed-v1.webp", protectionRate: .8, satisfactionBonus: 4, requiresBranding: true },
  { code: "printed-10", family: "printed", formatGrams: 10, name: "Doypack à ta marque · 10 g", unitCostCents: 125, image: "/placard/packaging-printed-v1.webp", protectionRate: .8, satisfactionBonus: 4, requiresBranding: true },
  { code: "glass-5", family: "glass", formatGrams: 5, name: "Pot en verre ambré · 5 g", unitCostCents: 180, image: "/placard/packaging-glass-v1.webp", protectionRate: .5, satisfactionBonus: 8, requiresBranding: false },
  { code: "glass-10", family: "glass", formatGrams: 10, name: "Pot en verre ambré · 10 g", unitCostCents: 210, image: "/placard/packaging-glass-v1.webp", protectionRate: .5, satisfactionBonus: 8, requiresBranding: false },
] as const;
export type KqOnlinePackagingCode = typeof KQ_ONLINE_PACKAGING[number]["code"];
export const KQ_ONLINE_SITE_TIERS = [
  { code: "basic", name: "Boutique de base", acquisitionCents: 0, monthlyCents: 0, conversionMultiplier: 1, minimumOrders: 0, minimumConfidence: 0, description: "Un modèle simple pour commencer. Aucun abonnement ; 2,5 % de frais sur les ventes." },
  { code: "improved", name: "Boutique améliorée", acquisitionCents: 90000, monthlyCents: 3000, conversionMultiplier: 1.25, minimumOrders: 5, minimumConfidence: 45, description: "Des fiches plus lisibles et un parcours mobile travaillé pour mieux convertir tes visiteurs." },
  { code: "pro", name: "Boutique professionnelle", acquisitionCents: 300000, monthlyCents: 6000, conversionMultiplier: 1.6, minimumOrders: 30, minimumConfidence: 60, description: "Une boutique sur mesure pour développer une clientèle déjà présente." },
] as const;
export type KqOnlineSiteTier = typeof KQ_ONLINE_SITE_TIERS[number]["code"];
export const KQ_ONLINE_UPGRADES = [
  { code: "photography", name: "Photos et fiches produits", costCents: 30000, description: "Une présentation soignée aide les visiteurs à choisir. Améliore la conversion de 10 %, sans créer de visites." },
  { code: "branding", name: "Identité par un graphiste", costCents: 70000, description: "Logo, couleurs et maquettes cohérentes. Débloque les doypacks imprimés et améliore la conversion de 8 %." },
] as const;
export type KqOnlineUpgradeCode = typeof KQ_ONLINE_UPGRADES[number]["code"];
export const KQ_ONLINE_MARKETING_MISSIONS = [
  { code: "introduction", name: "Présenter ta marque", description: "Choisis le public et le message de ton lancement. Une première campagne pour faire connaître ton commerce.", durationHours: 24, visitorsPerDay: 35, followersReward: 15, cooldownHours: 0, requiresStock: false, minimumOrders: 0 },
  { code: "harvest", name: "Présenter une récolte", description: "Mets en avant un lot mûr. Chaque récolte peut faire l’objet d’une présentation ; les visites ne garantissent pas l’achat.", durationHours: 48, visitorsPerDay: 50, followersReward: 25, cooldownHours: 72, requiresStock: true, minimumOrders: 0 },
  { code: "behind-scenes", name: "Les coulisses de ton atelier", description: "Prépare une publication sur ton savoir-faire, adaptée au public que tu veux toucher.", durationHours: 48, visitorsPerDay: 30, followersReward: 15, cooldownHours: 168, requiresStock: false, minimumOrders: 0 },
  { code: "feedback", name: "Échanger avec tes acheteurs", description: "Après cinq commandes, présente ton travail à partir des retours de tes clients.", durationHours: 48, visitorsPerDay: 20, followersReward: 10, cooldownHours: 168, requiresStock: false, minimumOrders: 5 },
] as const;
export type KqOnlineMarketingCode = typeof KQ_ONLINE_MARKETING_MISSIONS[number]["code"];
export const KQ_ONLINE_MARKETING_ANGLES = [
  { code: "value", name: "Accessible", description: "Des prix doux et une offre simple." },
  { code: "craft", name: "Artisanal", description: "Du savoir-faire et un rapport qualité/prix régulier." },
  { code: "premium", name: "Sélection", description: "Les meilleurs lots et une présentation soignée." },
] as const;
export type KqOnlineMarketingAngle = typeof KQ_ONLINE_MARKETING_ANGLES[number]["code"];
export type KqOnlineListingStatus = "active" | "paused" | "closed" | "sold-out" | "quality-blocked" | "discarded";
export type KqOnlineListing = {
  id: string; stockId: string; name: string; route: KqMarketRouteCode;
  formatGrams: 5 | 10; packagingCode: KqOnlinePackagingCode; packetPriceCents: number;
  initialPackets: number; remainingPackets: number; soldPackets: number;
  status: KqOnlineListingStatus; qualityScore: number; baseUnitCents: number; createdAt: string;
  offer?: { ordersPerDay: number; referencePacketCents: number; valueRatio: number;
    satisfactionScore: number; satisfaction: "satisfied" | "neutral" | "disappointed"; visitorsPerDay: number };
};
export type KqOnlineSale = {
  id: string; listingId: string; name: string; soldAt: string; packets: number;
  formatGrams: 5 | 10; packetPriceCents: number; payoutCents: number; netPayoutCents: number;
  feesCents: number; packagingCostCents: number; satisfaction: number;
};
export type KqOnlineSnapshot = {
  version: 1; serverNow: string; settledUntil: string;
  site: { tier: KqOnlineSiteTier; createdAt: string | null; active: boolean; feePercent: number; paidUntil: string | null; renew: boolean };
  upgrades: Record<KqOnlineUpgradeCode, boolean>; confidence: number; followers: number;
  packaging: Array<{ code: KqOnlinePackagingCode; quantity: number; unitCostCents: number }>;
  listings: KqOnlineListing[];
  marketing: { active: { id: string; code: KqOnlineMarketingCode; angle: KqOnlineMarketingAngle; startedAt: string; endsAt: string } | null; completedCodes: string[]; cooldowns: Record<string, string> };
  stats: { visitors: number; orders: number; revenueCents: number; netRevenueCents: number; feesCents: number; packagingCostCents: number; soldGrams: number };
  recentSales: KqOnlineSale[];
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
export function getKqOnlinePackaging(code: string) { return KQ_ONLINE_PACKAGING.find(item => item.code === code); }
/** Time from fresh preparation until the first quality tick below the retail gate. */
export function getKqOnlineSaleableHours(quality: number, packagingCode: string) {
  const packaging = getKqOnlinePackaging(packagingCode);
  if (!packaging || !Number.isFinite(quality) || quality < 5.8) return 0;
  return (Math.floor((Math.min(10, quality) - 5.8) / (.01 * packaging.protectionRate) + 1e-8) + 1) * 4;
}
export function getKqOnlineSiteTier(code: string) { return KQ_ONLINE_SITE_TIERS.find(item => item.code === code) ?? KQ_ONLINE_SITE_TIERS[0]; }
export function getKqOnlineUpgradeCost(current: KqOnlineSiteTier, next: KqOnlineSiteTier) {
  return Math.max(0, getKqOnlineSiteTier(next).acquisitionCents - getKqOnlineSiteTier(current).acquisitionCents);
}

/** Continuous and bounded. An absurd price has zero demand, never a minimum sale. */
export function getKqOnlinePriceAcceptance(ratio: number) {
  if (!Number.isFinite(ratio) || ratio < 0 || ratio >= 2.5) return 0;
  if (ratio <= 1) return Math.min(1.35, 1 + .35 * (1 - ratio));
  if (ratio <= 1.25) return 1 - .7 * (ratio - 1);
  return .825 * ((2.5 - ratio) / 1.25) ** 2;
}

export function getKqOnlineSatisfaction(quality: number, priceRatio: number, packagingBonus = 0) {
  return clamp(80 + (clamp(quality, 0, 10) - 7) * 3 + packagingBonus
    + Math.min(5, Math.max(0, 1 - priceRatio) * 20) - Math.max(0, priceRatio - 1) * 80, 0, 98);
}

/** Campaign traffic converts better when the offer matches the chosen message. */
export function getKqOnlineMarketingFit(angle: KqOnlineMarketingAngle, quality: number, priceRatio: number) {
  if (angle === "value") return priceRatio <= 1.05 ? 1.1 : .9;
  if (angle === "premium") return quality >= 8.5 && priceRatio >= 1 && priceRatio <= 1.5 ? 1.1 : .85;
  return quality >= 7.5 && priceRatio <= 1.3 ? 1.1 : .95;
}

export function getKqOnlineAudience(input: { online: KqOnlineSnapshot; reputation: number; clients: number; advertisingMultiplier?: number }) {
  const { online } = input;
  const now = Date.parse(online.serverNow);
  const active = online.marketing.active;
  const mission = active && Date.parse(active.startedAt) <= now && Date.parse(active.endsAt) > now
    ? KQ_ONLINE_MARKETING_MISSIONS.find(item => item.code === active.code) : null;
  return ((24 + clamp(online.followers, 0, 5000) * .12) * (1 + clamp(input.reputation / 6000, 0, .25))
    + Math.max(0, input.clients) * 2.4 + (mission?.visitorsPerDay ?? 0)) * clamp(input.advertisingMultiplier ?? 1, 1, 2);
}

/** A forecast at current conditions, not a promise; SQL settles each actual sale. */
export function estimateKqOnlineOffer(input: {
  quality: number; baseUnitCents: number; formatGrams: 5 | 10; packagingCode: string; packetPriceCents: number;
  reputation: number; clients: number; online: KqOnlineSnapshot; activeListingCount?: number; advertisingMultiplier?: number;
}) {
  const packaging = getKqOnlinePackaging(input.packagingCode);
  if (!packaging || packaging.formatGrams !== input.formatGrams) throw new Error("Choisis un emballage adapté au format.");
  const quality = clamp(input.quality, 0, 10);
  const brandPremium = clamp(input.reputation / 15000, 0, .2) * clamp((quality - 7) / 2, 0, 1);
  const referencePacketPriceCents = Math.max(1, Math.round(Math.max(0, input.baseUnitCents) * input.formatGrams
    * (.7 + quality / 20) * (1 + brandPremium) + packaging.unitCostCents));
  const validPrice = Number.isSafeInteger(input.packetPriceCents) && input.packetPriceCents >= 1 && input.packetPriceCents <= 1_000_000;
  const priceRatio = validPrice ? input.packetPriceCents / referencePacketPriceCents : Infinity;
  const satisfaction = getKqOnlineSatisfaction(quality, priceRatio, packaging.satisfactionBonus);
  const visitorsPerDay = getKqOnlineAudience(input);
  const campaign = input.online.marketing.active;
  const at = Date.parse(input.online.serverNow);
  const mission = campaign && Date.parse(campaign.startedAt) <= at && at < Date.parse(campaign.endsAt)
    ? KQ_ONLINE_MARKETING_MISSIONS.find(item => item.code === campaign.code) : null;
  const matchedAudience = visitorsPerDay + (mission && campaign ? mission.visitorsPerDay
    * clamp(input.advertisingMultiplier ?? 1, 1, 2) * (getKqOnlineMarketingFit(campaign.angle, quality, priceRatio) - 1) : 0);
  const tier = getKqOnlineSiteTier(input.online.site.tier);
  const conversion = .025 * tier.conversionMultiplier * (input.online.upgrades.photography ? 1.1 : 1)
    * (input.online.upgrades.branding ? 1.08 : 1) * (.4 + .6 * clamp(input.online.confidence, 0, 100) / 100);
  const qualityInterest = .75 + .25 * clamp((quality - 5.8) / 3.7, 0, 1);
  const competing = Math.max(1, input.activeListingCount ?? input.online.listings.filter(item => item.status === "active" && item.remainingPackets > 0).length);
  const allowed = validPrice && quality >= 5.8 && input.online.site.active && (!packaging.requiresBranding || input.online.upgrades.branding);
  const ordersPerDay = allowed ? matchedAudience * conversion * getKqOnlinePriceAcceptance(priceRatio) * qualityInterest * 5 / input.formatGrams / competing : 0;
  const feeCents = validPrice ? Math.round(input.packetPriceCents * KQ_ONLINE_FEE_PERCENT / 100) : 0;
  const vatCents = validPrice ? Math.round(input.packetPriceCents / 6) : 0;
  return {
    referencePacketPriceCents, priceRatio, satisfaction,
    satisfactionLabel: satisfaction >= 75 ? "satisfied" as const : satisfaction >= 60 ? "neutral" as const : "disappointed" as const,
    visitorsPerDay, ordersPerDay, gramsPerDay: ordersPerDay * input.formatGrams,
    feeCents, packagingCostCents: packaging.unitCostCents,
    // Packaging is already paid. This contribution estimate is NOT cash credited or total profit.
    netBeforeProductionCents: validPrice ? input.packetPriceCents - vatCents - feeCents - packaging.unitCostCents : 0,
    priceLabel: priceRatio < .9 ? "Accessible" : priceRatio <= 1.15 ? "Cohérent" : priceRatio <= 1.35 ? "Ambitieux" : "Difficile à justifier",
  };
}

/** Isolated tutorial data; never creates a real account or grants an asset. */
export function createKqOnlinePreview(nowMs: number): KqOnlineSnapshot {
  const now = new Date(nowMs).toISOString();
  return {
    version: 1, serverNow: now, settledUntil: now,
    site: { tier: "basic", createdAt: now, active: true, feePercent: KQ_ONLINE_FEE_PERCENT, paidUntil: null, renew: false },
    upgrades: { photography: false, branding: false }, confidence: 60, followers: 0,
    packaging: KQ_ONLINE_PACKAGING.map(item => ({ code: item.code, quantity: 0, unitCostCents: item.unitCostCents })), listings: [],
    marketing: { active: null, completedCodes: [], cooldowns: {} },
    stats: { visitors: 0, orders: 0, revenueCents: 0, netRevenueCents: 0, feesCents: 0, packagingCostCents: 0, soldGrams: 0 }, recentSales: [],
  };
}
