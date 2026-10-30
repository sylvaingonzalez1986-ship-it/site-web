import { describe, expect, it } from 'vitest';
import { createKqBusinessPreview } from '@/lib/kanab-quest-business';
import type { KqCommerceSnapshot } from '@/lib/kanab-quest-commerce';
import { createKqOnlinePreview, estimateKqOnlineOffer, type KqOnlineListing } from '@/lib/kanab-quest-online';
import { estimateKqMerchOffer } from '@/lib/kanab-quest-merch';
import { compareKqStudioOffers } from './kq-studio-preview';

const NOW = Date.parse('2026-10-30T12:00:00Z');
function state(): KqCommerceSnapshot {
  const online = createKqOnlinePreview(NOW);
  online.site.tier = 'flagship'; online.upgrades.branding = true;
  online.studio!.levels = { photography: 1, branding: 1, editorial: 1 };
  online.studio!.style = 'craft';
  online.merch!.modules = ['paper', 'textile', 'objects'];
  return { online, business: createKqBusinessPreview(NOW), cashCents: 100000, reputation: 200, clients: 8, revision: 0,
    computerOwned: true, internetRenew: false, campaign: null, stocks: [], receipts: [], rawLots: [],
    electricityOutstandingCents: 0, marketVolumes: {}, ownVolumes: {}, routeSales: {} };
}
function flower(overrides: Partial<KqOnlineListing> = {}): KqOnlineListing {
  return { id: 'flower-1', stockId: 'stock-1', name: 'Récolte A', route: 'raw', formatGrams: 5, packagingCode: 'kraft-5',
    packetPriceCents: 3500, initialPackets: 20, remainingPackets: 12, soldPackets: 8, status: 'active', qualityScore: 8,
    baseUnitCents: 180, createdAt: new Date(NOW).toISOString(),
    offer: { ordersPerDay: 12.345, valueRatio: 1, referencePacketCents: 3500, satisfactionScore: 80, satisfaction: 'satisfied', visitorsPerDay: 55 },
    ...overrides };
}
function candidate(data: KqCommerceSnapshot) {
  const online = structuredClone(data.online!);
  online.studio!.levels.photography = 2;
  return online;
}

describe('Studio comparisons keep the actual shop and distinguish missing data', () => {
  it('preserves the server rate and reference even when local audience data is unavailable', () => {
    const data = state(); data.online!.listings = [flower()]; data.clients = NaN;
    const next = candidate(data); next.followers = 9999; next.listings[0].packetPriceCents = 1;
    const original = structuredClone(data), result = compareKqStudioOffers(data, next);
    expect(result.flowersUnavailable).toBe(false);
    expect(result.offers[0]).toMatchObject({ id: 'flower-1', before: 12.345, unit: 'paquets / jour réel', reference: 'Prix de référence : 35 €' });
    expect(result.offers[0].after).toBeCloseTo(12.345 * 1.18 / 1.1, 10);
    expect(data).toEqual(original);
  });

  it('uses the offered ratio for editorial matching, including a customer-demand reference', () => {
    const data = state(); data.online!.listings = [flower({ qualityScore: 9, packetPriceCents: 5000,
      offer: { ...flower().offer!, valueRatio: 1.02, referencePacketCents: 4902 } })];
    const next = structuredClone(data.online!); next.studio!.style = 'clear';
    const result = compareKqStudioOffers(data, next).offers[0];
    expect(result.fit).toEqual({ matched: true, multiplier: 1.04 });
    expect(result.before).toBe(result.after);
  });

  it('estimates a legacy listing without an offer using the real audience and active reference count', () => {
    const data = state(); data.online!.listings = [flower({ offer: undefined }), flower({ id: 'flower-2', offer: undefined })];
    const row = data.online!.listings[0];
    const expected = estimateKqOnlineOffer({ ...row, quality: row.qualityScore, online: data.online!, reputation: data.reputation,
      clients: data.clients, activeListingCount: 2 });
    const result = compareKqStudioOffers(data, candidate(data));
    expect(result.flowersUnavailable).toBe(false);
    expect(result.offers[0].before).toBe(expected.ordersPerDay);
  });

  it.each(['clients', 'followers', 'confidence', 'marketing', 'tier', 'clock'] as const)('does not invent a legacy baseline with unavailable %s', field => {
    const data = state(); data.online!.listings = [flower({ offer: undefined })];
    if (field === 'clients') data.clients = NaN;
    if (field === 'followers') data.online!.followers = NaN;
    if (field === 'confidence') data.online!.confidence = NaN;
    if (field === 'marketing') delete (data.online as Partial<NonNullable<KqCommerceSnapshot['online']>>)!.marketing;
    if (field === 'tier') data.online!.site.tier = 'unknown' as NonNullable<KqCommerceSnapshot['online']>['site']['tier'];
    if (field === 'clock') data.online!.serverNow = 'invalid';
    expect(compareKqStudioOffers(data, candidate(data))).toMatchObject({ offers: [], flowersUnavailable: true });
  });

  it('omits an invalid server offer rather than replacing it with a computed zero', () => {
    const data = state(); data.online!.listings = [flower({ offer: { ...flower().offer!, ordersPerDay: NaN } })];
    expect(compareKqStudioOffers(data, candidate(data))).toMatchObject({ offers: [], flowersUnavailable: true });
  });

  it('keeps valid products comparable when another product is unavailable', () => {
    const data = state(); data.online!.listings = [flower(), flower({ id: 'invalid', packagingCode: 'bad' as KqOnlineListing['packagingCode'] })];
    const result = compareKqStudioOffers(data, candidate(data));
    expect(result.flowersUnavailable).toBe(true);
    expect(result.offers.map(row => row.id)).toEqual(['flower-1']);
  });

  it('shows zero for a suspended site without turning publication into an empty shop', () => {
    const data = state(); data.online!.listings = [flower()]; data.online!.site.active = false;
    data.online!.merch!.inventory = [{ code: 'stickers', quantity: 10, priceCents: 400, active: true, sold: 0, progress: 0 }];
    const result = compareKqStudioOffers(data, candidate(data));
    expect(result.offers.map(row => [row.before, row.after])).toEqual([[0, 0], [0, 0]]);
    expect(result.flowersUnavailable).toBe(false); expect(result.merchUnavailable).toBe(false);
  });

  it('compares each merch product with its own audience share and editorial tradeoff', () => {
    const data = state();
    data.online!.merch!.inventory = [
      { code: 'stickers', quantity: 10, priceCents: 400, active: true, sold: 0, progress: 0 },
      { code: 'mug', quantity: 20, priceCents: 1600, active: true, sold: 0, progress: 0 },
      { code: 'poster', quantity: 30, priceCents: 1200, active: false, sold: 0, progress: 0 },
    ];
    const next = structuredClone(data.online!); next.studio!.style = 'clear'; next.studio!.levels.branding = 3;
    const result = compareKqStudioOffers(data, next);
    expect(result.offers.map(row => row.id)).toEqual(['merch-stickers', 'merch-mug']);
    for (const [index, product] of data.online!.merch!.inventory.slice(0, 2).entries()) {
      const quote = (online: typeof next) => estimateKqMerchOffer({ online, code: product.code, priceCents: product.priceCents,
        reputation: data.reputation, clients: data.clients, activeProductCount: 2 }).unitsPerDay;
      expect(result.offers[index]).toMatchObject({ before: quote(data.online!), after: quote(next), unit: 'articles / jour réel' });
    }
  });

  it('does not hide readable flower offers when merch forecasts are unavailable', () => {
    const data = state(); data.online!.listings = [flower()]; data.clients = NaN;
    data.online!.merch!.inventory = [{ code: 'stickers', quantity: 10, priceCents: 400, active: true, sold: 0, progress: 0 }];
    const result = compareKqStudioOffers(data, candidate(data));
    expect(result.offers.map(row => row.id)).toEqual(['flower-1']);
    expect(result.merchUnavailable).toBe(true);
  });

  it('distinguishes an empty shop from missing listings and inventory', () => {
    const data = state();
    expect(compareKqStudioOffers(data, candidate(data))).toEqual({ offers: [], flowersUnavailable: false, merchUnavailable: false });
    delete (data.online as Partial<NonNullable<KqCommerceSnapshot['online']>>)!.listings;
    delete data.online!.merch;
    expect(compareKqStudioOffers(data, candidate(data))).toEqual({ offers: [], flowersUnavailable: true, merchUnavailable: true });
  });

  it('does not turn malformed studio levels into acquired level zero for a comparison', () => {
    const data = state(); data.online!.listings = [flower()]; data.online!.studio!.levels.editorial = NaN;
    expect(compareKqStudioOffers(data, candidate(data))).toMatchObject({ offers: [], flowersUnavailable: true });
  });

  it.each([null, { version: 2 }])('does not treat an unreadable Studio snapshot as the legacy protocol: %s', value => {
    const data = state(); data.online!.listings = [flower()];
    const next = candidate(data);
    data.online!.studio = value as unknown as NonNullable<KqCommerceSnapshot['online']>['studio'];
    expect(compareKqStudioOffers(data, next)).toMatchObject({ offers: [], flowersUnavailable: true });
  });
});
