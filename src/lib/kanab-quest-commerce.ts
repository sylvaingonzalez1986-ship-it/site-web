import { calculateKqMarketReputation, getKqMarketReputationRule, type KqMarketQuote, type KqMarketRouteCode } from "./kanab-quest-market";
import { getKqMarketReputationProgress } from "./kanab-quest-market-demand";
import { getChanvrierSalesMultiplier, type ChanvrierStrength } from "./arena-chanvrier";

export const KQ_COMPUTER_PRICE_CENTS = 45000;
export const KQ_INTERNET_PRICE_CENTS = 1500;
export const KQ_SALES_CHANNELS = ["online", "cbd-shop", "wholesale"] as const;
export type KqSalesChannel = typeof KQ_SALES_CHANNELS[number];
export type KqOnlinePrice = "discovery" | "advised" | "premium";
export const KQ_CHANNELS = {
  online: { name: "Vente en ligne", image: "/placard/channel-online-v1.webp", promise: "Ta clientèle. Tes prix.", description: "Meilleure marge au gramme, commandes limitées. La qualité fidélise tes clients." },
  "cbd-shop": { name: "CBD shops", image: "/placard/channel-cbd-shop-v1.webp", promise: "Du volume, tout de suite.", description: "La qualité et ton réseau de boutiques déterminent le prix de reprise." },
  wholesale: { name: "Grossistes", image: "/placard/channel-wholesale-v1.webp", promise: "Une sortie pour chaque lot.", description: "Tout le volume, quelle que soit la note. Reprise à 25–33 %, sans réputation." },
} as const;
export const KQ_COMMERCE_EVENTS: Record<string, string> = {
  normal: "Marché habituel", "spot-flower": "Les fleurs font parler d’elles", "spot-hash": "Le hash est à l’honneur",
  "spot-rosin": "Engouement pour le rosin", promotion: "Les concurrents font des promotions", restock: "Les boutiques refont leurs stocks",
};
export function getKqCommerceCapacity(reputation: number) {
  const thresholds = [0, 60, 200, 600, 1500, 3000];
  const index = Math.max(0, thresholds.findLastIndex(n => reputation >= n));
  return { baseUnits: [400, 600, 900, 1400, 2000, 2800][index], maxClients: [25, 40, 65, 100, 160, 240][index] };
}
export type KqCommerceCampaign = {
  id: string; revision: number; reputation: number; clientsStart: number; event: string; internetPaid: boolean;
  shopPartnersStart?: number; shopRecruitmentStart?: number; shopChurnStart?: number; shopGoodUnits?: number; shopBadUnits?: number;
  directUsed: number; shopUsed: number; goodUnits: number; disappointmentUnits: number;
};
export type KqCommerceStock = {
  id: string; flowerId: string; name: string; route: KqMarketRouteCode; batchRoute: KqMarketRouteCode;
  juryScore: number; initialUnits: number; remainingUnits: number; equivalentUnits: number; originalUnits: number;
  baseUnitCents: number; payoutExact?: number; payoutRounded?: number; repExact: number; repRounded: number; professionalUnits: number; counted: boolean;
};
export type KqCommerceState = {
  strength?: ChanvrierStrength | null;
  shopPartners?: number; shopRecruitment?: number; shopChurn?: number;
  rawFlowerIds?: string[]; revision: number; cashCents: number; reputation: number; clients: number; computerOwned: boolean; internetRenew: boolean;
  campaign: KqCommerceCampaign | null; stocks: KqCommerceStock[]; receipts: KqCommerceReceipt[];
  marketVolumes: Partial<Record<KqMarketRouteCode, number>>; ownVolumes: Partial<Record<KqMarketRouteCode, number>>;
  routeSales: Partial<Record<KqMarketRouteCode, number>>;
};
export type KqCommerceReceipt = {
  action: string; stockId?: string; flowerId?: string; channel?: KqSalesChannel; units?: number; payoutCents?: number;
  electricityPaidCents?: number; netPayoutCents?: number; cashAfterCents: number; reputationGain?: number;
  satisfaction?: KqCustomerSatisfaction; clientsBefore?: number; shopPartnersBefore?: number; shopPartnersAfter?: number; shopPartnersDelta?: number; shopPricePercent?: number;
  expertiseBonus?: number; clientsAfter?: number; remainingUnits?: number; replayed?: boolean;
};
export type KqCommerceRawLot = { flowerId: string; varietyName: string; juryScore: number; harvestGrams: number; options: KqMarketQuote[] };
export type KqCommerceSnapshot = KqCommerceState & { rawLots: KqCommerceRawLot[]; electricityOutstandingCents: number };
export type KqCustomerSatisfaction = "satisfied" | "neutral" | "disappointed" | "not-applicable";
export type KqCommerceOffer = {
  satisfaction: KqCustomerSatisfaction; clientsBefore: number;
  shopPartnersBefore: number; shopPartnersAfter: number; shopRecruitmentAfter: number; shopChurnAfter: number; shopGoodUnitsAfter: number; shopBadUnitsAfter: number; shopPricePercent: number;
  channel: KqSalesChannel; policy: KqOnlinePrice; units: number; maxUnits: number; unitCents: number; payoutCents: number;
  payoutExactAfter: number; payoutRoundedAfter: number; directCost: number; shopCost: number; equivalentSold: number; repExactAfter: number; repRoundedAfter: number;
  reputationDelta: number; goodUnitsAfter: number; disappointmentAfter: number; clientsAfter: number;
  reason: string | null; message: string;
};
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
export function getKqCommerceMinimumQuality(route: KqMarketRouteCode, channel: KqSalesChannel): number | null {
  if (channel === "wholesale") return null;
  return channel === "online" ? 5.8 : route === "raw" ? 6.5 : 7.5;
}
export const KQ_SHOP_MAX_PARTNERS = 20;
export const KQ_SHOP_PROGRESS_UNITS = 6000;
export const KQ_SHOP_QUALITY_BANDS = [
  { label: "Qualité limite", flowerMinimum: 6.5, extractMinimum: 7.5, pricePercent: 40, recruitmentWeight: 0, churnWeight: 6, satisfaction: "disappointed" },
  { label: "Qualité correcte", flowerMinimum: 7, extractMinimum: 8, pricePercent: 45, recruitmentWeight: 0, churnWeight: 0, satisfaction: "neutral" },
  { label: "Très bonne qualité", flowerMinimum: 8, extractMinimum: 9, pricePercent: 50, recruitmentWeight: 3, churnWeight: 0, satisfaction: "satisfied" },
  { label: "Qualité exceptionnelle", flowerMinimum: 9, extractMinimum: 9.5, pricePercent: 55, recruitmentWeight: 4, churnWeight: 0, satisfaction: "satisfied" },
] as const;
export function getKqShopQualityBand(route: KqMarketRouteCode, score: number) {
  return KQ_SHOP_QUALITY_BANDS.findLast(band => score >= (route === "raw" ? band.flowerMinimum : band.extractMinimum)) ?? KQ_SHOP_QUALITY_BANDS[0];
}
export function getKqShopNetworkBonus(partners: number) {
  return partners >= 12 ? 4 : partners >= 8 ? 3 : partners >= 4 ? 2 : partners >= 1 ? 1 : 0;
}
export function getKqShopBudget(partners: number, event: string = "normal") {
  return (4000 + clamp(partners, 0, KQ_SHOP_MAX_PARTNERS) * 250) * (event === "restock" ? 1.25 : event === "promotion" ? .75 : 1);
}
export function quoteKqCommerce(state: KqCommerceState, stock: KqCommerceStock, channel: KqSalesChannel, policy: KqOnlinePrice = "advised", requestedUnits?: number): KqCommerceOffer {
  const salesMultiplier = getChanvrierSalesMultiplier(state.strength);
  const campaign = state.campaign;
  const capacity = getKqCommerceCapacity(campaign?.reputation ?? state.reputation);
  const tier = getKqMarketReputationProgress(state.reputation).tier;
  const rule = getKqMarketReputationRule(stock.route);
  const salvage = stock.route === "biomass";
  const transformed = stock.route !== "raw" && !salvage;
  const family = stock.route.startsWith("rosin") ? "rosin" : transformed ? "hash" : "flower";
  const factorQuality = stock.juryScore >= 9.5 ? 1.1 : stock.juryScore >= rule.gainFrom ? 1 : stock.juryScore >= rule.neutralFrom ? .75 : .4;
  const factorPrice = policy === "discovery" ? 1.2 : policy === "premium" ? .7 : 1;
  const eventFactor = campaign?.event === `spot-${family}` ? 1.25 : campaign?.event === "promotion" ? .75 : 1;
  const volumes = Object.values(state.marketVolumes).reduce((a, b) => a + (b ?? 0), 0);
  const saturation = Math.min(.35, (state.ownVolumes[stock.route] ?? 0) / 1000 * .2 + (volumes >= 100 ? Math.max(0, (state.marketVolumes[stock.route] ?? 0) / volumes - .3) * .3 : 0));
  const demandFactor = factorQuality * factorPrice * eventFactor * (1 - saturation);
  const directBudget = salesMultiplier * capacity.baseUnits * (1 + .25 * Math.min(1, (campaign?.clientsStart ?? 0) / capacity.maxClients));
  const shopPartnersStart = campaign?.shopPartnersStart ?? 0;
  const shopBand = getKqShopQualityBand(stock.route, stock.juryScore);
  const shopPricePercent = shopBand.pricePercent + getKqShopNetworkBonus(shopPartnersStart);
  const shopBudget = salesMultiplier * getKqShopBudget(shopPartnersStart, campaign?.event);
  let reason: string | null = null;
  if (channel !== "wholesale" && !campaign) reason = "Termine une culture pour ouvrir les commandes du cycle.";
  if (channel === "online" && !state.computerOwned) reason = "Achète un ordinateur dans la boutique pour vendre en ligne.";
  else if (channel === "online" && !campaign?.internetPaid) reason = "Active Internet pour ce cycle : 15 €.";
  if (channel === "online" && (salvage || stock.juryScore < getKqCommerceMinimumQuality(stock.route, "online")!)) reason = "Qualité insuffisante pour la vente directe. Le grossiste reprend ce lot.";
  if (channel === "cbd-shop" && (salvage || stock.juryScore < getKqCommerceMinimumQuality(stock.route, "cbd-shop")!)) reason = "La boutique refuse cette qualité. Le grossiste reste disponible.";
  const eqPerUnit = stock.equivalentUnits / stock.initialUnits;
  const availableEq = channel === "online" ? Math.max(0, directBudget - (campaign?.directUsed ?? 0)) * demandFactor
    : channel === "cbd-shop" ? Math.max(0, shopBudget - (campaign?.shopUsed ?? 0)) : stock.remainingUnits * eqPerUnit;
  const maxUnits = reason ? 0 : Math.min(stock.remainingUnits, Math.max(0, Math.floor(availableEq / eqPerUnit + 1e-8)));
  if (!reason && maxUnits === 0) reason = "Les commandes de ce cycle sont épuisées. Conserve le stock ou change de circuit.";
  const units = clamp(Math.floor(Number.isFinite(requestedUnits) ? requestedUnits! : maxUnits), 0, maxUnits);
  const equivalentSold = round6(units * eqPerUnit);
  const protectedPrice = tier.guaranteedPolicy === "premium";
  const onlinePrice = Math.max(.6, (policy === "premium" ? 1.22 : policy === "discovery" ? .9 : 1) * (1 + tier.priceBonusPercent / 100)
    * (.7 + stock.juryScore / 20) * (protectedPrice ? Math.max(1, eventFactor) : eventFactor * (1 - saturation)));
  const professionalPrice = channel === "cbd-shop" ? shopPricePercent / 100
    : campaign?.event === "promotion" ? .25 : campaign?.event === "restock" ? .33 : .3;
  const unitCents = round6(salvage ? stock.baseUnitCents : stock.baseUnitCents * (channel === "online" ? onlinePrice : professionalPrice));
  // One cumulative ledger across all prices and channels prevents rounding arbitrage.
  const payoutExactAfter = round6((stock.payoutExact ?? 0) + units * unitCents / 10);
  const payoutRoundedAfter = Math.round(payoutExactAfter);
  const payoutCents = payoutRoundedAfter - (stock.payoutRounded ?? 0);
  const repExactAfter = round6(stock.repExact + calculateKqMarketReputation(stock.route, stock.juryScore) * equivalentSold / stock.originalUnits * (channel === "online" ? 1 : channel === "cbd-shop" ? .5 : 0));
  const repRoundedAfter = Math.sign(repExactAfter) * Math.floor(Math.abs(repExactAfter) + .5);
  const reputationDelta = repRoundedAfter - stock.repRounded;
  const goodUnitsAfter = round6((campaign?.goodUnits ?? 0) + (channel === "online" && stock.juryScore >= rule.gainFrom ? equivalentSold * salesMultiplier : 0));
  const disappointmentAfter = round6((campaign?.disappointmentUnits ?? 0) + (channel === "online" && stock.juryScore < rule.neutralFrom
    ? equivalentSold * (stock.juryScore < rule.neutralFrom - .5 ? .25 : .1) : 0));
  const clientsAfter = channel === "online" ? clamp((campaign?.clientsStart ?? 0) + Math.floor(Math.min(5 * salesMultiplier, goodUnitsAfter / capacity.baseUnits * 5))
    - Math.floor((campaign?.clientsStart ?? 0) * Math.min(.25, disappointmentAfter / capacity.baseUnits)), 0, capacity.maxClients) : state.clients;
  // Weighted equivalent mass has a common integer denominator: no per-sale rounding of partners.
  const shopGoodUnitsAfter = round6((campaign?.shopGoodUnits ?? 0) + (channel === "cbd-shop" ? equivalentSold * shopBand.recruitmentWeight * salesMultiplier : 0));
  const shopBadUnitsAfter = round6((campaign?.shopBadUnits ?? 0) + (channel === "cbd-shop" ? equivalentSold * shopBand.churnWeight : 0));
  const recruitment = round6((campaign?.shopRecruitmentStart ?? 0) + Math.min(KQ_SHOP_PROGRESS_UNITS * salesMultiplier, shopGoodUnitsAfter));
  const churn = round6((campaign?.shopChurnStart ?? 0) + Math.min(Math.max(1, Math.ceil(shopPartnersStart / 4)) * KQ_SHOP_PROGRESS_UNITS, shopBadUnitsAfter));
  const partnersGained = Math.floor(recruitment / KQ_SHOP_PROGRESS_UNITS);
  const partnersLost = Math.floor(churn / KQ_SHOP_PROGRESS_UNITS);
  const shopPartnersAfter = channel === "cbd-shop" ? clamp(shopPartnersStart + partnersGained - partnersLost, 0, KQ_SHOP_MAX_PARTNERS) : state.shopPartners ?? 0;
  const shopRecruitmentAfter = channel === "cbd-shop" ? round6(recruitment % KQ_SHOP_PROGRESS_UNITS) : state.shopRecruitment ?? 0;
  const shopChurnAfter = channel === "cbd-shop" ? round6(churn % KQ_SHOP_PROGRESS_UNITS) : state.shopChurn ?? 0;
  const satisfaction: KqCustomerSatisfaction = channel === "wholesale" ? "not-applicable"
    : channel === "cbd-shop" ? shopBand.satisfaction
    : stock.juryScore >= rule.gainFrom ? "satisfied" : stock.juryScore >= rule.neutralFrom ? "neutral" : "disappointed";
  const message = channel === "wholesale" ? "Reprise de tout le volume, sans exigence de note ni gain de réputation."
    : channel === "cbd-shop" ? `${shopBand.label} : reprise à ${shopPricePercent} % du tarif de référence. ${shopBand.churnWeight ? "Ces livraisons fragilisent tes partenariats." : shopBand.recruitmentWeight ? "Ces livraisons construisent ton réseau de boutiques." : "Ces livraisons maintiennent tes partenariats."}`
    : stock.juryScore < rule.neutralFrom ? "Une livraison décevante peut faire partir des clients. La perte dépend du volume livré."
    : protectedPrice ? "Ta réputation protège le prix, mais les commandes restent limitées." : "Les bons lots construisent ta clientèle pour les prochains cycles.";
  return { shopPartnersBefore: state.shopPartners ?? 0, shopPartnersAfter, shopRecruitmentAfter, shopChurnAfter, shopGoodUnitsAfter, shopBadUnitsAfter, shopPricePercent, satisfaction, clientsBefore: state.clients, channel, policy, units, maxUnits, unitCents, payoutCents, payoutExactAfter, payoutRoundedAfter, directCost: channel === "online" ? round6(equivalentSold / demandFactor) : 0,
    shopCost: channel === "cbd-shop" ? equivalentSold : 0, equivalentSold, repExactAfter, repRoundedAfter, reputationDelta,
    goodUnitsAfter, disappointmentAfter, clientsAfter, reason, message };
}
