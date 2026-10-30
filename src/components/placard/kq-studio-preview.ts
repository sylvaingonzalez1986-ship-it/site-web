import type { KqCommerceSnapshot } from '@/lib/kanab-quest-commerce';
import { getKqAdvertisingMultiplier, isKqAdvertisingKind } from '@/lib/kanab-quest-business';
import { formatKqCash } from '@/lib/kanab-quest-equipment';
import { getKqShopActivity } from '@/lib/kanab-quest-shop-activity';
import { estimateKqOnlineOffer, getKqOnlinePackaging, KQ_ONLINE_MARKETING_MISSIONS, KQ_ONLINE_SITE_TIERS, type KqOnlineSnapshot } from '@/lib/kanab-quest-online';
import { getKqStudioEditorialFit, getKqStudioFlowerMultiplier, type KqStudioStyle } from '@/lib/kanab-quest-studio';

export const kqStudioStyleLabels: Record<KqStudioStyle, string> = { clear: 'Clair', craft: 'Atelier', signature: 'Signature' };

export type KqStudioOfferComparison = {
  id: string; name: string; unit: string; before: number; after: number;
  fit: ReturnType<typeof getKqStudioEditorialFit>; detail: string; reference: string;
};
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const count = (value: unknown): value is number => finite(value) && Number.isSafeInteger(value);
const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const number = (value: number) => value.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

function studioKnown(online: KqOnlineSnapshot) {
  return typeof online.upgrades?.photography === 'boolean' && typeof online.upgrades?.branding === 'boolean'
    && (online.studio === undefined || (online.studio?.version === 1 && Object.hasOwn(kqStudioStyleLabels, online.studio.style)
      && (['photography', 'branding', 'editorial'] as const).every(track => count(online.studio!.levels?.[track]) && online.studio!.levels[track] <= 3)));
}

/** Only older listings without a server offer need this local forecast. Missing
 * audience or campaign inputs must not turn into default traffic or zero sales. */
function flowerForecastKnown(data: KqCommerceSnapshot, online: KqOnlineSnapshot) {
  const campaign = online.marketing?.active;
  const campaignKnown = campaign === null || (campaign && date(campaign.startedAt) && date(campaign.endsAt)
    && ['value', 'craft', 'premium'].includes(campaign.angle)
    && (campaign.version === 2 ? date(campaign.launchesAt) && finite(campaign.visitorsPerDay) && typeof campaign.listingId === 'string'
      : KQ_ONLINE_MARKETING_MISSIONS.some(item => item.code === campaign.code)));
  const ad = data.business?.advertising;
  const adKnown = !data.business || ad === null || (ad && isKqAdvertisingKind(ad.kind) && date(ad.startedAt) && date(ad.endsAt)
    && typeof data.business.shop?.active === 'boolean');
  return date(online.serverNow) && KQ_ONLINE_SITE_TIERS.some(item => item.code === online.site?.tier)
    && finite(data.reputation) && count(data.clients) && count(online.followers)
    && finite(online.confidence) && online.confidence <= 100 && campaignKnown && adKnown;
}

/** Compare only real products, keeping audience, prices and publication state
 * unchanged. The supplied candidate contributes its studio settings alone. */
export function compareKqStudioOffers(data: KqCommerceSnapshot, candidate: KqOnlineSnapshot): {
  offers: KqStudioOfferComparison[]; flowersUnavailable: boolean; merchUnavailable: boolean;
} {
  const online = data.online;
  if (!online) return { offers: [], flowersUnavailable: true, merchUnavailable: true };
  const preview = { ...online, studio: candidate.studio };
  const activity = getKqShopActivity(data);
  const comparable = studioKnown(online) && studioKnown(preview) && typeof online.site?.active === 'boolean';
  const flowers = activity.flowers.activeListings === null ? null
    : online.listings.filter(row => row.status === 'active' && row.remainingPackets > 0 && row.qualityScore >= 5.8);
  let flowersUnavailable = flowers === null || (!comparable && Boolean(flowers.length));
  const offers: KqStudioOfferComparison[] = [];

  if (comparable) for (const row of flowers ?? []) {
    const packaging = getKqOnlinePackaging(row.packagingCode);
    if (!row.id || typeof row.name !== 'string' || !row.name || !count(row.packetPriceCents) || row.packetPriceCents < 1
      || row.packetPriceCents > 1_000_000 || !packaging || packaging.formatGrams !== row.formatGrams) {
      flowersUnavailable = true; continue;
    }
    let before: number, ratio: number, reference: number;
    if (row.offer !== undefined) {
      if (!finite(row.offer?.valueRatio) || !count(row.offer?.referencePacketCents) || row.offer.referencePacketCents < 1
        || (online.site.active && !finite(row.offer?.ordersPerDay))) {
        flowersUnavailable = true; continue;
      }
      before = online.site.active ? row.offer.ordersPerDay : 0;
      ratio = row.offer.valueRatio;
      reference = row.offer.referencePacketCents;
    } else {
      if (!flowerForecastKnown(data, online) || !finite(row.baseUnitCents)) { flowersUnavailable = true; continue; }
      // Optional older demand snapshots can be absent. A malformed supplied
      // snapshot is unavailable; it must not silently become an ordinary price.
      if (data.customerDemand && (data.customerDemand.version !== 1 || !Array.isArray(data.customerDemand.requests))) {
        flowersUnavailable = true; continue;
      }
      try {
        const estimate = estimateKqOnlineOffer({ online, listingId: row.id, route: row.route, varietyCode: row.varietyCode,
          customerDemand: data.customerDemand, quality: row.qualityScore, baseUnitCents: row.baseUnitCents,
          formatGrams: row.formatGrams, packagingCode: row.packagingCode, packetPriceCents: row.packetPriceCents,
          reputation: data.reputation, clients: data.clients, activeListingCount: flowers!.length,
          advertisingMultiplier: getKqAdvertisingMultiplier(data.business, Date.parse(online.serverNow)) });
        before = online.site.active ? estimate.ordersPerDay : 0;
        ratio = estimate.priceRatio;
        reference = estimate.referencePacketPriceCents;
      } catch {
        flowersUnavailable = true; continue;
      }
    }
    const after = before * getKqStudioFlowerMultiplier(preview, row.qualityScore, ratio)
      / getKqStudioFlowerMultiplier(online, row.qualityScore, ratio);
    if (![before, after, ratio, reference].every(finite)) { flowersUnavailable = true; continue; }
    offers.push({ id: row.id, name: row.name, unit: 'paquets / jour réel', before, after,
      fit: getKqStudioEditorialFit(preview, { quality: row.qualityScore, priceRatio: ratio }),
      detail: `${number(row.qualityScore)}/10 · ${formatKqCash(row.packetPriceCents)} / ${row.formatGrams} g`,
      reference: `Prix de référence : ${formatKqCash(reference)}` });
  }

  const projected = getKqShopActivity({ ...data, online: preview }).merch;
  const merch = activity.merch;
  let merchUnavailable = !merch.available || merch.active === null || projected.active === null
    || (!comparable && Boolean(merch.active.length));
  if (comparable) for (const row of merch.active ?? []) {
    const after = projected.active?.find(item => item.code === row.code)?.estimatedUnitsPerDay;
    if (row.quantity === null || row.quantity > 500 || row.priceCents === null
      || !finite(row.estimatedUnitsPerDay) || !finite(after)) {
      merchUnavailable = true; continue;
    }
    offers.push({ id: `merch-${row.code}`, name: row.product.name, unit: 'articles / jour réel', before: row.estimatedUnitsPerDay, after,
      fit: getKqStudioEditorialFit(preview, { merchCode: row.code, priceRatio: row.priceCents / row.product.referencePriceCents }),
      detail: `${row.quantity} en stock · ${formatKqCash(row.priceCents)} / article`,
      reference: `Prix de référence : ${formatKqCash(row.product.referencePriceCents)}` });
  }
  return { offers, flowersUnavailable, merchUnavailable };
}
