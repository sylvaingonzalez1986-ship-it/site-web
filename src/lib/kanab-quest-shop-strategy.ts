import { getKqAdvertisingMultiplier } from "./kanab-quest-business";
import type { KqCommerceSnapshot } from "./kanab-quest-commerce";
import { estimateKqOnlineOffer, getKqOnlineAudience, getKqOnlinePackaging, getKqOnlineSaleableHours, type KqOnlineListing, type KqOnlineSnapshot } from "./kanab-quest-online";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const QUALITY_TICK = 4 * HOUR;
const HORIZON_DAYS = 7;
const EPSILON = 1e-8;

export type KqShopStrategyCode = "rotation" | "balance" | "selection";
export type KqShopStrategyPlan = {
  code: KqShopStrategyCode;
  name: string;
  description: string;
  packetPriceCents: number;
  ordersPerDay: number;
  contributionPerPacketCents: number;
  contributionPerDayCents: number;
  satisfactionScore: number;
  projectedPackets: number;
  projectedContributionCents: number;
  remainingPackets: number;
  /** Unsold packets crossing the retail quality gate during the forecast. */
  atRiskPackets: number;
  horizonDays: number;
  current: boolean;
};

const STRATEGIES = [
  { code: "rotation", name: "Rotation", ratio: .9, description: "Un prix accessible pour écouler plus vite et soigner les premiers avis." },
  { code: "balance", name: "Équilibre", ratio: 1.05, description: "Un compromis entre cadence de vente, contribution et satisfaction." },
  { code: "selection", name: "Sélection", ratio: 1.25, description: "Plus de contribution par paquet ; une clientèle plus exigeante et moins de commandes." },
] as const;

function canSell(listing: KqOnlineListing) {
  return listing.status === "active" && listing.remainingPackets > EPSILON && listing.qualityScore >= 5.8;
}

function quote(data: KqCommerceSnapshot, online: KqOnlineSnapshot, listing: KqOnlineListing, activeListingCount: number, customerDemand = data.customerDemand) {
  return estimateKqOnlineOffer({
    listingId: listing.id, quality: listing.qualityScore, route: listing.route, varietyCode: listing.varietyCode, customerDemand,
    baseUnitCents: listing.baseUnitCents, formatGrams: listing.formatGrams, packagingCode: listing.packagingCode,
    packetPriceCents: listing.packetPriceCents, reputation: data.reputation, clients: data.clients, online,
    activeListingCount, advertisingMultiplier: getKqAdvertisingMultiplier(data.business, Date.parse(online.serverNow)),
  });
}

/** Quality is already aged in the snapshot. Only subtract ticks after serverNow. */
function qualityAt(listing: KqOnlineListing, start: number, at: number) {
  const created = Date.parse(listing.createdAt);
  const ticks = Math.floor(Math.max(0, at - created) / QUALITY_TICK) - Math.floor(Math.max(0, start - created) / QUALITY_TICK);
  return Math.max(0, Math.round((listing.qualityScore - ticks * .01 * (getKqOnlinePackaging(listing.packagingCode)?.protectionRate ?? 1)) * 1e8) / 1e8);
}

function saleableDays(listing: KqOnlineListing, now: number) {
  const hours = getKqOnlineSaleableHours(listing.qualityScore, listing.packagingCode);
  if (!hours) return 0;
  const phase = Math.max(0, now - Date.parse(listing.createdAt)) % QUALITY_TICK;
  return Math.max(0, hours * HOUR - phase) / DAY;
}

export function getKqShopDashboard(data: KqCommerceSnapshot) {
  const online = data.online;
  const at = online ? Date.parse(online.serverNow) : 0;
  const sellable = online?.listings.filter(canSell) ?? [];
  const listings = sellable.map(listing => {
    const offer = quote(data, online!, listing, sellable.length);
    const ordersPerDay = online!.site.active ? offer.ordersPerDay : 0;
    return { listing, ordersPerDay, visitorsPerDay: offer.visitorsPerDay, contributionPerDayCents: ordersPerDay * offer.netBeforeProductionCents,
      stockDays: ordersPerDay > 0 ? listing.remainingPackets / ordersPerDay : null,
      saleableDays: saleableDays(listing, at), satisfactionScore: offer.satisfaction };
  });
  const ordersPerDay = listings.reduce((sum, listing) => sum + listing.ordersPerDay, 0);
  const remainingPackets = listings.reduce((sum, entry) => sum + entry.listing.remainingPackets, 0);
  const visitorsPerDay = online?.site.active ? online.marketing.active?.version === 2
    ? Math.max(getKqOnlineAudience({ online: { ...online, marketing: { ...online.marketing, active: null } }, reputation: data.reputation, clients: data.clients,
      advertisingMultiplier: getKqAdvertisingMultiplier(data.business, at) }), ...listings.map(entry => entry.visitorsPerDay))
    : getKqOnlineAudience({ online, reputation: data.reputation, clients: data.clients,
      advertisingMultiplier: getKqAdvertisingMultiplier(data.business, at) }) : 0;
  const bottleneck = !online?.site.createdAt
    ? { code: "unopened", title: "Ouvre ton point de vente", description: "Un ordinateur et un nom de marque suffisent pour commencer gratuitement." }
    : !online.site.active
      ? { code: "suspended", title: "Rallume la boutique", description: "L’hébergement est suspendu. Réactive le site pour reprendre les commandes." }
      : !listings.length
        ? { code: "stock", title: "Tes rayons attendent leurs produits", description: "Prépare des paquets ou remets une annonce en vente pour convertir tes visites." }
        : listings.some(entry => entry.saleableDays < (entry.stockDays ?? Infinity))
          ? { code: "quality", title: "Écoule les lots qui vieillissent", description: "Au rythme actuel, un lot risque de passer sous le seuil de vente avant d’être épuisé. Teste un prix de rotation." }
          : listings.some(entry => entry.satisfactionScore < 60 || entry.ordersPerDay === 0)
            ? { code: "price", title: "Revois la promesse de tes prix", description: "Certains prix freinent l’achat ou risquent de décevoir. Compare les stratégies avant d’attirer plus de visiteurs." }
            : online.confidence < 60
              ? { code: "confidence", title: "Construis ta réputation de commerçant", description: "Des paquets au juste prix et des clients satisfaits aideront tes prochaines visites à convertir." }
              : listings.some(entry => entry.stockDays !== null && entry.stockDays < 3)
                ? { code: "restock", title: "Prépare la relève", description: "Un rayon a moins de trois jours de stock au rythme actuel. Anticipe le prochain conditionnement." }
                : { code: "audience", title: "Fais venir les prochains clients", description: "Tes rayons sont prêts. Une campagne adaptée à ta gamme peut accélérer les visites." };
  return { visitorsPerDay, ordersPerDay,
    contributionPerDayCents: listings.reduce((sum, listing) => sum + listing.contributionPerDayCents, 0),
    activeListings: listings.length, remainingPackets, stockDays: ordersPerDay > 0 ? remainingPackets / ordersPerDay : null,
    conversionPercent: visitorsPerDay > 0 ? ordersPerDay / visitorsPerDay * 100 : 0, bottleneck, listings };
}

/**
 * A decision aid, never a second settlement engine. Expected packet quantities
 * can be fractional. Audience, confidence and reputation stay at their current
 * levels; no new campaigns, renewals, harvests or future market demands are
 * assumed. Known campaign expiry, packaging decay, stock and demand caps apply.
 */
function project(data: KqCommerceSnapshot, selected: KqOnlineListing, packetPriceCents: number) {
  const original = data.online!;
  const start = Date.parse(original.serverNow);
  const end = start + HORIZON_DAYS * DAY;
  const source = original.listings.filter(canSell);
  const remaining = new Map(source.map(listing => [listing.id, listing.remainingPackets]));
  const customerDemand = data.customerDemand ? { ...data.customerDemand, requests: data.customerDemand.requests.map(request => ({ ...request })) } : undefined;
  let sold = 0;
  let contribution = 0;
  let at = start;

  while (at < end) {
    // Forecast only the hosting period already paid for; future renewals spend
    // real game cash and may fail, so never assume them in a recommendation.
    if (!original.site.active || (original.site.tier !== "basic" && (!original.site.paidUntil || at >= Date.parse(original.site.paidUntil)))) break;
    const listings = source.map(listing => ({ ...listing, remainingPackets: remaining.get(listing.id)!, qualityScore: qualityAt(listing, start, at),
      packetPriceCents: listing.id === selected.id ? packetPriceCents : listing.packetPriceCents })).filter(canSell);
    if (!listings.some(listing => listing.id === selected.id)) break;
    const online = { ...original, serverNow: new Date(at).toISOString(), listings };
    const offers = listings.map(listing => ({ listing, offer: quote(data, online, listing, listings.length, customerDemand) }));
    let next = Math.min(end, at + HOUR);
    for (const listing of listings) {
      const created = Date.parse(listing.createdAt);
      next = Math.min(next, created + (Math.floor(Math.max(0, at - created) / QUALITY_TICK) + 1) * QUALITY_TICK);
    }
    for (const boundary of [original.marketing.active?.startedAt, original.marketing.active?.version === 2 ? original.marketing.active.launchesAt : null, original.marketing.active?.endsAt,
      data.business?.advertising?.startedAt, data.business?.advertising?.endsAt, original.site.tier !== "basic" ? original.site.paidUntil : null,
      customerDemand?.endsAt]) {
      const time = boundary ? Date.parse(boundary) : NaN;
      if (time > at) next = Math.min(next, time);
    }
    // Stop at a stock-out so the remaining listings receive the freed audience.
    for (const { listing, offer } of offers) if (offer.ordersPerDay > 0) {
      next = Math.min(next, at + listing.remainingPackets / offer.ordersPerDay * DAY);
    }
    // Matching listings draw from one current premium allowance. End the
    // interval at its depletion rather than extending the bonus past its cap.
    const demandRates = new Map<string, number>();
    for (const { listing, offer } of offers) if (offer.customerDemand) {
      demandRates.set(offer.customerDemand.id, (demandRates.get(offer.customerDemand.id) ?? 0) + offer.ordersPerDay * listing.formatGrams * 10);
    }
    for (const request of customerDemand?.requests ?? []) {
      const unitsPerDay = demandRates.get(request.id) ?? 0;
      if (unitsPerDay > 0) next = Math.min(next, at + request.remainingUnits / unitsPerDay * DAY);
    }
    const days = (next - at) / DAY;
    if (!(days > 0)) break;
    const usage = new Map<string, number>();
    for (const { listing, offer } of offers) {
      const packets = Math.min(listing.remainingPackets, offer.ordersPerDay * days);
      remaining.set(listing.id, Math.max(0, listing.remainingPackets - packets));
      if (listing.id === selected.id) {
        sold += packets;
        contribution += packets * offer.netBeforeProductionCents;
      }
      if (offer.customerDemand) usage.set(offer.customerDemand.id, (usage.get(offer.customerDemand.id) ?? 0) + packets * listing.formatGrams * 10);
    }
    for (const request of customerDemand?.requests ?? []) request.remainingUnits = Math.max(0, request.remainingUnits - (usage.get(request.id) ?? 0));
    at = next;
  }
  const left = Math.max(0, selected.remainingPackets - sold);
  return { projectedPackets: Math.min(selected.remainingPackets, sold), projectedContributionCents: Math.round(contribution),
    remainingPackets: left, atRiskPackets: saleableDays(selected, start) <= HORIZON_DAYS ? left : 0 };
}

/** Presets only propose a price. The UI submits the existing update-listing command. */
export function getKqShopStrategyPlans(data: KqCommerceSnapshot, listingId: string): KqShopStrategyPlan[] {
  const online = data.online;
  const listing = online?.listings.find(item => item.id === listingId);
  if (!online || !listing || !canSell(listing)) return [];
  const activeCount = online.listings.filter(canSell).length;
  const reference = quote(data, online, listing, activeCount).referencePacketPriceCents;
  return STRATEGIES.map(strategy => {
    const packetPriceCents = Math.min(1_000_000, Math.max(1, Math.round(reference * strategy.ratio)));
    const offer = quote(data, online, { ...listing, packetPriceCents }, activeCount);
    return { code: strategy.code, name: strategy.name, description: strategy.description, packetPriceCents,
      ordersPerDay: offer.ordersPerDay, contributionPerPacketCents: offer.netBeforeProductionCents,
      contributionPerDayCents: offer.ordersPerDay * offer.netBeforeProductionCents, satisfactionScore: offer.satisfaction,
      ...project(data, listing, packetPriceCents), horizonDays: HORIZON_DAYS, current: packetPriceCents === listing.packetPriceCents };
  });
}
