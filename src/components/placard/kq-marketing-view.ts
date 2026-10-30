import type { KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import { KQ_ADVERTISING } from "@/lib/kanab-quest-business";
import { KQ_MARKETING_BUDGETS, KQ_MARKETING_CAMPAIGNS, getKqMarketingPreview } from "@/lib/kanab-quest-marketing";
import { KQ_MARKET_ROUTE_CODES } from "@/lib/kanab-quest-market";
import { KQ_ONLINE_SITE_TIERS, getKqOnlinePackaging, type KqOnlineListing } from "@/lib/kanab-quest-online";

type Input = Parameters<typeof getKqMarketingPreview>[0];
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const date = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const text = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const statuses = ["active", "paused", "closed", "sold-out", "quality-blocked", "discarded"];

function validListing(row: KqOnlineListing) {
  const packaging = getKqOnlinePackaging(row.packagingCode);
  return text(row.id) && text(row.stockId) && text(row.name)
    && KQ_MARKET_ROUTE_CODES.includes(row.route)
    && count(row.packetPriceCents) && row.packetPriceCents >= 1 && row.packetPriceCents <= 1_000_000
    && finite(row.baseUnitCents) && date(row.createdAt)
    && packaging?.formatGrams === row.formatGrams;
}

function validDemand(data: KqCommerceSnapshot) {
  const demand = data.customerDemand;
  if (demand === undefined) return true;
  return demand?.version === 1 && count(demand.period) && date(demand.startsAt) && date(demand.endsAt)
    && Date.parse(demand.endsAt) > Date.parse(demand.startsAt)
    && Array.isArray(demand.requests) && demand.requests.every(request => request && text(request.id)
      && count(request.period) && ["online", "cbd-shop", "wholesale"].includes(request.channel)
      && Array.isArray(request.flavorCodes) && request.flavorCodes.length === 2 && request.flavorCodes.every(text)
      && finite(request.bonusPercent) && finite(request.minimumQuality) && request.minimumQuality <= 10
      && count(request.capacityUnits) && count(request.remainingUnits) && request.remainingUnits <= request.capacityUnits);
}

function validAdvertising(data: KqCommerceSnapshot) {
  const business = data.business;
  if (business === undefined || business?.advertising === null) return true;
  if (!business || business.advertising === undefined) return false;
  const ad = business.advertising, shop = business.shop;
  return Object.hasOwn(KQ_ADVERTISING, ad.kind) && date(ad.startedAt) && date(ad.endsAt)
    && Boolean(shop) && typeof shop.active === "boolean" && (shop.createdAt === null || date(shop.createdAt))
    && (shop.tier === undefined || KQ_ONLINE_SITE_TIERS.some(tier => tier.code === shop.tier))
    && (shop.paidUntil === null || date(shop.paidUntil));
}

/** Read-only presentation guard. Missing state stays unavailable; the existing
 * simulation and the server's purchase validation retain their own rules. */
export function getKqMarketingView(input: Input) {
  const { data } = input, online = data.online, marketing = online?.marketing;
  const marketingKnown = Boolean(marketing && (marketing.active === null || record(marketing.active))
    && Array.isArray(marketing.completedCodes) && marketing.completedCodes.every(code => typeof code === "string")
    && record(marketing.cooldowns) && Object.values(marketing.cooldowns).every(date));
  const supported = marketing?.version === 2;
  const selectedCode = input.code === "introduction" && Array.isArray(marketing?.completedCodes) && marketing.completedCodes.includes("introduction") ? "harvest" : input.code;
  const selectedBudget = selectedCode === "introduction" ? "local" : input.budgetCode;
  const definition = KQ_MARKETING_CAMPAIGNS.find(item => item.code === selectedCode)!;
  const budget = KQ_MARKETING_BUDGETS.find(item => item.code === selectedBudget)!;
  const costCents = selectedCode === "introduction" ? 0 : budget.costCents;
  const dataIssues: string[] = [];
  if (!marketingKnown) dataIssues.push("L’état des campagnes est indisponible. Actualise les données.");

  const rows = Array.isArray(online?.listings) ? online.listings : null;
  const rowsKnown = rows !== null && rows.every(row => row && text(row.id) && statuses.includes(row.status)
    && count(row.remainingPackets) && (row.status !== "active" || (finite(row.qualityScore) && row.qualityScore <= 10)))
    && new Set(rows.map(row => row.id)).size === rows.length;
  const eligible = rowsKnown ? rows.filter(row => row.status === "active" && row.remainingPackets > 0 && row.qualityScore >= 5.8) : null;
  const listings = eligible?.every(validListing) ? eligible : null;
  if (listings === null) dataIssues.push("Le stock en vente est incomplet. Actualise les annonces avant de préparer une campagne.");
  const listing = listings?.find(row => row.id === input.listingId) ?? listings?.[0] ?? null;
  if (!count(data.cashCents)) dataIssues.push("La trésorerie disponible est inconnue. Actualise les données avant d’engager un budget.");
  const serverNow = date(online?.serverNow) ? Date.parse(online.serverNow) : NaN;
  if (!Number.isFinite(serverNow) || !Number.isFinite(new Date(serverNow + 72 * 3_600_000).getTime())) {
    dataIssues.push("L’heure de la boutique est indisponible. La durée de la campagne ne peut pas être calculée.");
  }
  const site = online?.site;
  if (!site || typeof site.active !== "boolean" || !KQ_ONLINE_SITE_TIERS.some(tier => tier.code === site.tier)
    || (site.tier !== "basic" && site.paidUntil !== null && !date(site.paidUntil))) {
    dataIssues.push("L’état de la boutique est indisponible. Actualise les données.");
  }
  if (!count(online?.stats?.orders)) dataIssues.push("Le nombre de commandes réalisées est indisponible.");
  if (!finite(data.reputation) || !count(data.clients) || !count(online?.followers)
    || !finite(online?.confidence) || online.confidence > 100) {
    dataIssues.push("L’audience ou la confiance est indisponible. Les prévisions ne peuvent pas être calculées.");
  }
  const studio = online?.studio;
  if (typeof online?.upgrades?.photography !== "boolean" || typeof online?.upgrades?.branding !== "boolean"
    || (studio !== undefined && (studio?.version !== 1 || !["clear", "craft", "signature"].includes(studio.style)
      || !(["photography", "branding", "editorial"] as const).every(track => count(studio.levels?.[track]) && studio.levels[track] <= 3)))) {
    dataIssues.push("Les améliorations de la boutique sont indisponibles. Les prévisions ne peuvent pas être calculées.");
  }
  if (!validDemand(data)) dataIssues.push("Les demandes du marché sont indisponibles. Les prévisions ne peuvent pas être calculées.");
  if (!validAdvertising(data)) dataIssues.push("L’état de la publicité est indisponible. Les prévisions ne peuvent pas être calculées.");
  if (definition.requiresStock) {
    if (!Array.isArray(data.stocks) || data.stocks.some(stock => !stock || !text(stock.id))) {
      dataIssues.push("Les récoltes sont indisponibles. Actualise les stocks avant de les promouvoir.");
    } else {
      const stock = data.stocks.find(row => row.id === listing?.stockId);
      if (stock?.storage && (!date(stock.storage.serverNow) || !date(stock.storage.readyAt))) {
        dataIssues.push("La date de fin de curing est indisponible pour cette récolte.");
      }
    }
    if (marketing?.history !== undefined && (!Array.isArray(marketing.history) || marketing.history.some(report => !report || !text(report.code)))) {
      dataIssues.push("L’historique des récoltes présentées est indisponible.");
    }
  }

  let preview: ReturnType<typeof getKqMarketingPreview> | null = null;
  if (listing && dataIssues.length === 0) {
    preview = getKqMarketingPreview({ ...input, code: selectedCode, budgetCode: selectedBudget, listingId: listing.id });
    const values = [preview.referencePacketCents, preview.satisfactionScore, preview.fit, preview.projectedExtraOrders,
      preview.projectedExtraContributionCents, preview.netAfterCampaignCents, preview.expectedFollowers];
    if (values.some(value => !Number.isFinite(value))) {
      preview = null;
      dataIssues.push("Les prévisions sont indisponibles avec les données reçues. Actualise avant de lancer la campagne.");
    }
  }
  const blockingReasons = preview ? [...preview.blockingReasons] : [...dataIssues];
  if (!preview) {
    if (!supported) blockingReasons.push("Les nouvelles campagnes sont momentanément indisponibles.");
    if (site?.active === false) blockingReasons.push("Ouvre ou réactive ta boutique avant de lancer une campagne.");
    if (marketing?.active) blockingReasons.push("Une campagne occupe déjà ton atelier.");
    if (listings?.length === 0) blockingReasons.push("Mets des paquets en vente avant de préparer une campagne.");
    if (count(data.cashCents) && data.cashCents < costCents) blockingReasons.push("Ta trésorerie ne couvre pas ce budget.");
    if (count(online?.stats?.orders) && online.stats.orders < definition.minimumOrders) {
      blockingReasons.push(`Réalise d’abord ${definition.minimumOrders} commandes pour utiliser les retours clients.`);
    }
    const cooldown = marketingKnown ? marketing!.cooldowns[selectedCode] : undefined;
    if (cooldown && Date.parse(cooldown) > serverNow) blockingReasons.push(`Cette campagne sera disponible le ${new Date(cooldown).toLocaleString("fr-FR", {
      day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
    })} (heure de Paris).`);
  }
  return { definition, budget, costCents, selectedCode, selectedBudget, marketingKnown, supported,
    listings, listing, preview, dataIssues, blockingReasons, warnings: preview?.warnings ?? [],
    canLaunch: Boolean(preview?.ready && marketingKnown && supported && marketing?.active === null) };
}
