import { getKqAdvertisingMultiplier } from "./kanab-quest-business";
import { isKqCommerceStockMature, type KqCommerceSnapshot } from "./kanab-quest-commerce";
import { estimateKqOnlineOffer, getKqOnlinePackaging, type KqOnlineMarketingAngle, type KqOnlineMarketingCode } from "./kanab-quest-online";

export type KqMarketingCampaignCode = KqOnlineMarketingCode;
export const KQ_MARKETING_BUDGETS = [
  { code: "local", name: "Local", costCents: 3000, visitorsPerDay: 75 },
  { code: "regional", name: "Régional", costCents: 8000, visitorsPerDay: 160 },
  { code: "national", name: "National", costCents: 18000, visitorsPerDay: 280 },
] as const;
export type KqMarketingBudgetCode = typeof KQ_MARKETING_BUDGETS[number]["code"];
export const KQ_MARKETING_CAMPAIGNS = [
  { code: "introduction", name: "Lancement de marque", description: "Une première prise de parole offerte pour faire découvrir un produit et gagner tes premiers abonnés.", objective: "Gagner 15 abonnés", preparationHours: 0, durationHours: 24, trafficMultiplier: 1, followersPerOrder: 5, goalOrders: 3, followersCap: 15, cooldownHours: 0, minimumOrders: 0, requiresStock: false, once: true },
  { code: "harvest", name: "Sortie de récolte", description: "Un lancement concentré sur une récolte prête à vendre. Plus de trafic, mais une seule campagne par récolte.", objective: "Gagner 20 abonnés", preparationHours: 4, durationHours: 48, trafficMultiplier: 1.25, followersPerOrder: 4, goalOrders: 5, followersCap: 20, cooldownHours: 72, minimumOrders: 0, requiresStock: true, once: false },
  { code: "behind-scenes", name: "Les coulisses de l’atelier", description: "Prends le temps de montrer ton savoir-faire. Moins de visites, mais chaque commande satisfaite construit davantage ton audience.", objective: "Gagner 30 abonnés", preparationHours: 12, durationHours: 48, trafficMultiplier: .75, followersPerOrder: 10, goalOrders: 3, followersCap: 30, cooldownHours: 168, minimumOrders: 0, requiresStock: false, once: false },
  { code: "feedback", name: "La parole aux clients", description: "Après tes premières commandes, investis dans les retours clients. Les acheteurs satisfaits peuvent devenir tes meilleurs relais.", objective: "Gagner 40 abonnés", preparationHours: 4, durationHours: 48, trafficMultiplier: .5, followersPerOrder: 10, goalOrders: 4, followersCap: 40, cooldownHours: 168, minimumOrders: 5, requiresStock: false, once: false },
] as const;

export type KqMarketingCampaignResults = { orders: number; satisfiedOrders: number; revenueCents: number; netRevenueCents: number; followersEarned: number };
export type KqMarketingCampaignActive = {
  version: 2; id: string; code: KqMarketingCampaignCode; angle: KqOnlineMarketingAngle;
  listingId: string; listingName: string; budgetCode: KqMarketingBudgetCode; costCents: number;
  visitorsPerDay: number; followersPerOrder: number; goalOrders: number; followersCap: number;
  startedAt: string; launchesAt: string; endsAt: string; results: KqMarketingCampaignResults;
};
export type KqMarketingCampaignReport = KqMarketingCampaignActive & { completedAt: string };

export function getKqMarketingFit(angle: KqOnlineMarketingAngle, quality: number, priceRatio: number) {
  if (angle === "value") return priceRatio <= 1.05 ? 1.15 : .35;
  if (angle === "premium") return quality >= 8.5 && priceRatio >= 1 && priceRatio <= 1.5 ? 1.15 : .3;
  return quality >= 7.5 && priceRatio <= 1.3 ? 1.15 : .45;
}
export function createKqMarketingResults(): KqMarketingCampaignResults {
  return { orders: 0, satisfiedOrders: 0, revenueCents: 0, netRevenueCents: 0, followersEarned: 0 };
}

/** A planning estimate. Actual purchases and campaign rewards remain server-owned. */
export function getKqMarketingPreview(input: { data: KqCommerceSnapshot; code: KqMarketingCampaignCode; angle: KqOnlineMarketingAngle; listingId: string; budgetCode: KqMarketingBudgetCode }) {
  const { data, angle } = input;
  const definition = KQ_MARKETING_CAMPAIGNS.find(item => item.code === input.code)!;
  const budget = KQ_MARKETING_BUDGETS.find(item => item.code === (input.code === "introduction" ? "local" : input.budgetCode))!;
  const online = data.online;
  const listing = online?.listings.find(item => item.id === input.listingId);
  const now = online ? Date.parse(online.serverNow) : 0;
  const HOUR = 3_600_000;
  const costCents = input.code === "introduction" ? 0 : budget.costCents;
  const visitorsPerDay = input.code === "introduction" ? 35 : budget.visitorsPerDay * definition.trafficMultiplier;
  const launches = now + definition.preparationHours * HOUR;
  const ends = launches + definition.durationHours * HOUR;
  const blockingReasons: string[] = [];
  const warnings: string[] = [];
  if (online?.marketing.version !== 2) blockingReasons.push("Le nouvel atelier de campagne n’est pas encore disponible sur ce serveur.");
  if (!online?.site.active) blockingReasons.push("Ouvre ou réactive ta boutique avant de lancer une campagne.");
  if (online?.marketing.active) blockingReasons.push("Une campagne occupe déjà ton atelier.");
  if (!listing || listing.status !== "active" || listing.remainingPackets <= 0 || listing.qualityScore < 5.8) blockingReasons.push("Choisis une annonce active, avec des paquets de qualité suffisante.");
  if (data.cashCents < costCents) blockingReasons.push("Ta trésorerie ne couvre pas ce budget.");
  if (definition.once && online?.marketing.completedCodes.includes(input.code)) blockingReasons.push("Le lancement de marque a déjà été utilisé.");
  const cooldown = online?.marketing.cooldowns[input.code];
  if (cooldown && Date.parse(cooldown) > now) blockingReasons.push(`Cette campagne sera disponible le ${new Date(cooldown).toLocaleString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })} (heure de Paris).`);
  if ((online?.stats.orders ?? 0) < definition.minimumOrders) blockingReasons.push(`Réalise d’abord ${definition.minimumOrders} commandes pour utiliser les retours clients.`);
  if (definition.requiresStock && listing) {
    const stock = data.stocks.find(item => item.id === listing.stockId);
    // Fully packed lots may disappear from the bulk stock snapshot. A live
    // listing already passed preparation gates; the server still rechecks its
    // source and full harvest history when the campaign is submitted.
    if (stock && !isKqCommerceStockMature(stock, now)) blockingReasons.push("Cette récolte doit terminer sa maturation avant sa présentation.");
    if (online?.marketing.history?.some(campaign => campaign.version === 2 && campaign.code === "harvest" && data.online?.listings.find(row => row.id === campaign.listingId)?.stockId === listing.stockId)) warnings.push("Cette récolte a peut-être déjà été présentée ; le serveur vérifiera son historique complet.");
  }
  const expiry = online && online.site.tier !== "basic" ? online.site.paidUntil ? Date.parse(online.site.paidUntil) : now : Infinity;
  if (expiry < ends) warnings.push("L’hébergement payé expire avant la fin : la prévision s’arrête à cette échéance, sans supposer de renouvellement.");
  const active: KqMarketingCampaignActive = { version: 2, id: "campaign-preview", code: input.code, angle, listingId: input.listingId,
    listingName: listing?.name ?? "", budgetCode: budget.code, costCents, visitorsPerDay, followersPerOrder: definition.followersPerOrder,
    goalOrders: definition.goalOrders, followersCap: definition.followersCap, startedAt: new Date(now).toISOString(), launchesAt: new Date(launches).toISOString(), endsAt: new Date(ends).toISOString(), results: createKqMarketingResults() };
  const activeCount = Math.max(1, online?.listings.filter(row => row.status === "active" && row.remainingPackets > 0 && row.qualityScore >= 5.8).length ?? 1);
  const packetUnits = (listing?.formatGrams ?? 5) * 10;
  const copyDemand = () => data.customerDemand ? { ...data.customerDemand, requests: data.customerDemand.requests.map(request => ({ ...request,
    remainingUnits: request.channel === "online" ? Math.floor(request.remainingUnits / packetUnits) * packetUnits : request.remainingUnits })) } : undefined;
  const campaignDemand = copyDemand(), baselineDemand = copyDemand();
  const qualityAt = (at: number) => {
    if (!listing) return 0;
    const created = Date.parse(listing.createdAt);
    const ticks = Math.floor(Math.max(0, at - created) / (4 * HOUR)) - Math.floor(Math.max(0, now - created) / (4 * HOUR));
    return Math.max(0, Math.round((listing.qualityScore - ticks * .01 * (getKqOnlinePackaging(listing.packagingCode)?.protectionRate ?? 1)) * 1e8) / 1e8);
  };
  const offer = (at: number, campaign: KqMarketingCampaignActive | null, demand = data.customerDemand) => {
    if (!online || !listing) return null;
    // Fractional expected sales are integrated continuously. A partially sold
    // expected packet keeps its remaining bonus until its whole allowance is
    // consumed; the time boundary below prevents granting a second packet.
    const customerDemand = demand ? { ...demand, requests: demand.requests.map(request => request.channel === "online" && request.remainingUnits > 1e-8
      ? { ...request, remainingUnits: Math.max(packetUnits, request.remainingUnits) } : request) } : undefined;
    return estimateKqOnlineOffer({ ...listing, listingId: listing.id, quality: qualityAt(at), customerDemand, reputation: data.reputation, clients: data.clients,
      online: { ...online, serverNow: new Date(at).toISOString(), marketing: { ...online.marketing, active: campaign } }, activeListingCount: activeCount,
      advertisingMultiplier: getKqAdvertisingMultiplier(data.business, at) });
  };
  let launchOffer = offer(launches, active, campaignDemand);
  let baselineOffer = offer(launches, null, baselineDemand);
  if (listing && qualityAt(launches) < 5.8) warnings.push("La qualité risque de passer sous le seuil de vente avant la diffusion.");
  let projectedOrders = 0, baselineOrders = 0, satisfiedOrders = 0;
  let remaining = listing?.remainingPackets ?? 0, baselineRemaining = remaining;
  // Hourly expected sales integrate preparation without campaign traffic. Each
  // scenario owns its own remaining stock; competitors and future reputation
  // are deliberately held constant, rather than promising unearned growth.
  let at = now;
  while (at < Math.min(ends, expiry) && remaining + baselineRemaining > 0) {
    let next = Math.min(at + HOUR, ends, expiry);
    if (listing) {
      const created = Date.parse(listing.createdAt);
      next = Math.min(next, created + (Math.floor(Math.max(0, at - created) / (4 * HOUR)) + 1) * 4 * HOUR);
    }
    for (const boundary of [launches, Date.parse(data.customerDemand?.endsAt ?? ""), Date.parse(data.business?.advertising?.endsAt ?? "")]) {
      if (boundary > at) next = Math.min(next, boundary);
    }
    const campaignOffer = offer(at, active, campaignDemand), organicOffer = offer(at, null, baselineDemand);
    if (at === launches) { launchOffer = campaignOffer; baselineOffer = organicOffer; }
    for (const [forecast, demand, stock] of [[campaignOffer, campaignDemand, remaining], [organicOffer, baselineDemand, baselineRemaining]] as const) {
      if (!forecast?.customerDemand || forecast.ordersPerDay <= 0 || stock <= 0) continue;
      const allowance = demand?.requests.find(request => request.id === forecast.customerDemand!.id)?.remainingUnits ?? 0;
      if (allowance > 1e-8) next = Math.min(next, at + allowance / (forecast.ordersPerDay * packetUnits) * 24 * HOUR);
    }
    const days = (next - at) / (24 * HOUR);
    if (!(days > 0)) break;
    const packets = Math.min(remaining, (campaignOffer?.ordersPerDay ?? 0) * days);
    const organic = Math.min(baselineRemaining, (organicOffer?.ordersPerDay ?? 0) * days);
    for (const [forecast, demand, sold] of [[campaignOffer, campaignDemand, packets], [organicOffer, baselineDemand, organic]] as const) {
      if (!forecast?.customerDemand) continue;
      const allowance = demand?.requests.find(request => request.id === forecast.customerDemand!.id);
      if (allowance) allowance.remainingUnits = Math.max(0, allowance.remainingUnits - sold * packetUnits);
    }
    remaining -= packets; baselineRemaining -= organic;
    if (at >= launches) {
      projectedOrders += packets; baselineOrders += organic;
      if ((campaignOffer?.satisfaction ?? 0) >= 75) satisfiedOrders += packets;
    }
    at = next;
  }
  const fit = launchOffer && listing ? getKqMarketingFit(angle, qualityAt(launches), launchOffer.priceRatio) : 0;
  if (fit > 0 && fit < 1) warnings.push("Le public choisi correspond mal au prix ou à la qualité de ce produit : une partie du budget attirera peu d’acheteurs.");
  if (launchOffer && launchOffer.satisfaction < 75) warnings.push("Au prix actuel, les commandes risquent de ne pas être assez satisfaisantes pour rapporter des abonnés.");
  const contributionPerPacketCents = launchOffer?.netBeforeProductionCents ?? 0;
  if (listing && budget.code !== "local" && remaining < 1e-8) warnings.push("Le stock peut être épuisé avant la fin. Compare un budget plus faible : davantage de visites ne crée pas de paquets supplémentaires.");
  const projectedExtraOrders = Math.max(0, projectedOrders - baselineOrders);
  const projectedExtraContributionCents = Math.round(projectedExtraOrders * contributionPerPacketCents);
  if (projectedOrders < definition.goalOrders) warnings.push("Le stock et la cadence estimée ne suffisent pas forcément à atteindre l’objectif d’abonnés.");
  return { definition, budget, listing, ready: blockingReasons.length === 0, blockingReasons, warnings, costCents, visitorsPerDay, fit,
    referencePacketCents: launchOffer?.referencePacketPriceCents ?? 0, satisfactionScore: launchOffer?.satisfaction ?? 0,
    ordersPerDay: launchOffer?.ordersPerDay ?? 0, extraOrdersPerDay: Math.max(0, (launchOffer?.ordersPerDay ?? 0) - (baselineOffer?.ordersPerDay ?? 0)),
    projectedOrders, projectedExtraOrders, contributionPerPacketCents, projectedExtraContributionCents,
    netAfterCampaignCents: projectedExtraContributionCents - costCents,
    breakEvenOrders: contributionPerPacketCents > 0 ? Math.ceil(costCents / contributionPerPacketCents) : null,
    expectedFollowers: Math.min(definition.followersCap, Math.floor(satisfiedOrders) * definition.followersPerOrder) };
}
