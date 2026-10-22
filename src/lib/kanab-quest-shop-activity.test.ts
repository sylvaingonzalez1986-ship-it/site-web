import { describe, expect, it } from 'vitest';
import { createKqBusinessPreview } from './kanab-quest-business';
import type { KqCommerceSnapshot } from './kanab-quest-commerce';
import { createKqOnlinePreview, type KqOnlineListing, type KqOnlineSale } from './kanab-quest-online';
import { estimateKqMerchOffer, type KqMerchInventory } from './kanab-quest-merch';
import { getKqShopActivity } from './kanab-quest-shop-activity';

const NOW = Date.parse('2026-10-21T12:00:00Z');
function state(): KqCommerceSnapshot {
  const online = createKqOnlinePreview(NOW), business = createKqBusinessPreview(NOW);
  online.site.tier = 'studio'; online.upgrades.branding = true;
  online.merch!.modules = ['paper', 'textile', 'objects'];
  business.shop = { ...business.shop, name: 'Atelier', createdAt: online.site.createdAt, active: true, tier: 'studio' };
  return { online, business, cashCents: 100000, reputation: 200, clients: 8, revision: 0, computerOwned: true, internetRenew: false,
    campaign: null, stocks: [], receipts: [], rawLots: [], electricityOutstandingCents: 0, marketVolumes: {}, ownVolumes: {}, routeSales: {} };
}
function flower(overrides: Partial<KqOnlineListing> = {}): KqOnlineListing {
  return { id: 'flower-listing', stockId: 'flower-stock', name: 'Fleur A', route: 'raw', formatGrams: 5, packagingCode: 'kraft-5',
    packetPriceCents: 3500, initialPackets: 20, remainingPackets: 12, soldPackets: 8, status: 'active', qualityScore: 8,
    baseUnitCents: 180, createdAt: new Date(NOW).toISOString(), ...overrides };
}
function merchandise(overrides: Partial<KqMerchInventory> = {}): KqMerchInventory {
  return { code: 'stickers', quantity: 20, priceCents: 400, active: true, sold: 4, progress: .3, ...overrides };
}
function flowerSale(overrides: Partial<KqOnlineSale> = {}): KqOnlineSale {
  return { id: 'receipt', listingId: 'flower-listing', name: 'Fleur A', soldAt: '2026-10-21T10:00:00Z', packets: 2, formatGrams: 5,
    packetPriceCents: 3500, payoutCents: 7000, netPayoutCents: 5200, feesCents: 175, packagingCostCents: 50, satisfaction: 80, ...overrides };
}

describe('unified shop activity without merging product units', () => {
  it('recognizes a merch-only shop without creating flower orders or packets', () => {
    const data = state();
    data.online!.merch!.inventory = [merchandise()];
    data.online!.merch!.stats = { ...data.online!.merch!.stats, unitsSold: 4, revenueCents: 1600, netRevenueCents: 1000 };
    const before = structuredClone(data), result = getKqShopActivity(data);
    expect(result.flowers).toEqual({ activeListings: 0, activePackets: 0, remainingPackets: 0, orders: 0, revenueCents: 0, netRevenueCents: 0 });
    expect(result.merch).toMatchObject({ available: true, activeUnits: 20, remainingUnits: 20, unitsSold: 4, revenueCents: 1600, netRevenueCents: 1000 });
    expect(result.merch.active).toHaveLength(1); expect(result.merch.paused).toEqual([]); expect(result.merch.soldOut).toEqual([]);
    expect(result.merch.estimatedUnitsPerDay).toBeGreaterThan(0);
    expect(data).toEqual(before);
  });

  it('keeps actual flower orders separate from merch units and recent receipt counts', () => {
    const data = state(); data.online!.listings = [flower()]; data.online!.stats.orders = 40;
    data.online!.merch!.inventory = [merchandise()]; data.online!.merch!.stats.unitsSold = 77;
    const result = getKqShopActivity(data);
    expect(result.flowers.orders).toBe(40); expect(result.flowers.activePackets).toBe(12);
    expect(result.merch.unitsSold).toBe(77); expect(result.merch.activeUnits).toBe(20);
    expect(result.receipts).toEqual([]); expect(result.receiptsComplete).toBe(true);
  });

  it('distinguishes unpublished, active and exhausted references while preserving total stock', () => {
    const data = state();
    data.online!.merch!.inventory = [merchandise(), merchandise({ code: 'poster', quantity: 7, priceCents: 1200, active: false }),
      merchandise({ code: 'tote', quantity: 0, priceCents: 1800, active: false })];
    data.online!.listings = [flower(), flower({ id: 'paused', status: 'paused', remainingPackets: 6 }),
      flower({ id: 'old', qualityScore: 5.79, remainingPackets: 2 })];
    const result = getKqShopActivity(data);
    expect(result.merch.active?.map(entry => entry.code)).toEqual(['stickers']);
    expect(result.merch.paused?.map(entry => entry.code)).toEqual(['poster']);
    expect(result.merch.soldOut?.map(entry => entry.code)).toEqual(['tote']);
    expect(result.merch.remainingUnits).toBe(27); expect(result.merch.activeUnits).toBe(20);
    expect(result.merch.paused?.[0].estimatedUnitsPerDay).toBe(0);
    expect(result.merch.soldOut?.[0].estimatedUnitsPerDay).toBe(0);
    expect(result.flowers.activeListings).toBe(1); expect(result.flowers.activePackets).toBe(12); expect(result.flowers.remainingPackets).toBe(20);
  });

  it('preserves publication during hosting suspension and truthfully shows zero current demand', () => {
    const data = state(); data.online!.merch!.inventory = [merchandise()]; data.online!.site.active = false;
    const result = getKqShopActivity(data);
    expect(result.merch.active?.[0].status).toBe('active'); expect(result.merch.activeUnits).toBe(20);
    expect(result.merch.paused).toEqual([]); expect(result.merch.estimatedUnitsPerDay).toBe(0);
  });

  it('reuses real per-product demand including identity and editorial fit, shared across active references', () => {
    const data = state(), online = data.online!;
    online.studio!.levels = { photography: 3, branding: 3, editorial: 3 }; online.studio!.style = 'clear';
    online.merch!.inventory = [merchandise(), merchandise({ code: 'mug', priceCents: 1600 }),
      merchandise({ code: 'poster', priceCents: 1200, active: false })];
    const result = getKqShopActivity(data);
    const expected = online.merch!.inventory.slice(0, 2).map(row => estimateKqMerchOffer({ online, code: row.code, priceCents: row.priceCents,
      reputation: data.reputation, clients: data.clients, activeProductCount: 2 }).unitsPerDay);
    expect(result.merch.active!.map(entry => entry.estimatedUnitsPerDay)).toEqual(expected);
    expect(result.merch.estimatedUnitsPerDay).toBeCloseTo(expected[0] + expected[1], 10);
  });

  it('does not multiply merch demand with flower campaigns, advertising or additional flower listings', () => {
    const data = state(); data.online!.merch!.inventory = [merchandise()];
    const initial = getKqShopActivity(data).merch.estimatedUnitsPerDay;
    data.online!.listings = [flower(), flower({ id: 'second' })];
    data.online!.marketing.active = { id: 'campaign', code: 'introduction', angle: 'value', startedAt: '2026-10-21T11:00:00Z', endsAt: '2026-10-22T11:00:00Z' };
    expect(getKqShopActivity(data).merch.estimatedUnitsPerDay).toBe(initial);
  });
});

describe('historical and incomplete shop snapshots', () => {
  it('retains flower-only historical activity with unavailable merch instead of invented zeros', () => {
    const data = state(); delete data.online!.merch; data.online!.listings = [flower()]; data.online!.recentSales = [flowerSale()];
    const result = getKqShopActivity(data);
    expect(result.flowers.activePackets).toBe(12); expect(result.receipts).toHaveLength(1);
    expect(result.merch).toEqual({ available: false, inventory: null, active: null, paused: null, soldOut: null,
      remainingUnits: null, activeUnits: null, unitsSold: null, revenueCents: null, netRevenueCents: null, estimatedUnitsPerDay: null });
    expect(result.receiptsComplete).toBe(false);
  });

  it('shows unknown flower and merch figures when the online snapshot is absent', () => {
    const data = state(); delete data.online;
    const result = getKqShopActivity(data);
    expect(Object.values(result.flowers).every(value => value === null)).toBe(true);
    expect(result.receipts).toEqual([]); expect(result.receiptsComplete).toBe(false);
  });

  it.each(['modules', 'confidence', 'followers', 'clients', 'reputation', 'price', 'studio'])('keeps unknown %s data from becoming a zero demand forecast', field => {
    const data = state(), online = data.online!; online.merch!.inventory = [merchandise()];
    if (field === 'modules') Reflect.deleteProperty(online.merch!, 'modules');
    if (field === 'confidence') Reflect.deleteProperty(online, 'confidence');
    if (field === 'followers') Reflect.deleteProperty(online, 'followers');
    if (field === 'clients') Reflect.deleteProperty(data, 'clients');
    if (field === 'reputation') data.reputation = NaN;
    if (field === 'price') Reflect.deleteProperty(online.merch!.inventory[0], 'priceCents');
    if (field === 'studio') Reflect.deleteProperty(online.studio!.levels, 'editorial');
    const result = getKqShopActivity(data);
    expect(result.merch.estimatedUnitsPerDay).toBeNull();
    expect(result.merch.active?.[0].estimatedUnitsPerDay).toBeNull();
    expect(result.merch.activeUnits).toBe(20);
  });

  it('keeps a partially unknown inventory distinct from an empty shop', () => {
    const data = state(); data.online!.merch!.inventory = [merchandise()];
    Reflect.deleteProperty(data.online!.merch!.inventory[0], 'quantity');
    const result = getKqShopActivity(data);
    expect(result.merch.inventory?.[0].status).toBe('unknown');
    expect(result.merch.active).toBeNull(); expect(result.merch.paused).toBeNull(); expect(result.merch.soldOut).toBeNull();
    expect(result.merch.remainingUnits).toBeNull(); expect(result.merch.activeUnits).toBeNull(); expect(result.merch.estimatedUnitsPerDay).toBeNull();
  });

  it('does not derive lifetime sales or turnover from a truncated receipt list', () => {
    const data = state(); Reflect.deleteProperty(data.online!.merch!, 'stats'); Reflect.deleteProperty(data.online!, 'stats');
    data.online!.recentSales = [flowerSale()];
    const result = getKqShopActivity(data);
    expect(result.flowers.orders).toBeNull(); expect(result.flowers.revenueCents).toBeNull();
    expect(result.merch.unitsSold).toBeNull(); expect(result.merch.netRevenueCents).toBeNull();
    expect(result.receipts).toHaveLength(1);
  });

  it('rejects duplicate catalogue rows instead of counting the same merch inventory twice', () => {
    const data = state(); data.online!.merch!.inventory = [merchandise(), merchandise()];
    const result = getKqShopActivity(data);
    expect(result.merch.inventory).toBeNull(); expect(result.merch.remainingUnits).toBeNull(); expect(result.merch.estimatedUnitsPerDay).toBeNull();
  });
});

describe('unified recent receipts', () => {
  it('orders real sales across both circuits without confusing cash credited and TTC revenue', () => {
    const data = state();
    data.online!.recentSales = [flowerSale(), flowerSale({ id: 'latest', soldAt: '2026-10-21T12:00:00Z' })];
    data.online!.merch!.recentSales = [{ id: 'receipt', code: 'stickers', quantity: 3, soldAt: '2026-10-21T11:00:00Z',
      priceCents: 400, netPayoutCents: 700, feesCents: 30, costCents: 240 }];
    const result = getKqShopActivity(data);
    expect(result.receipts.map(receipt => receipt.id)).toEqual(['flower:latest', 'merch:receipt', 'flower:receipt']);
    expect(result.receipts[1]).toMatchObject({ kind: 'merch', name: 'Stickers', quantity: 3, unitLabel: 'articles', formatGrams: null,
      revenueCents: 1200, netPayoutCents: 700, feesCents: 30, costCents: 240, satisfaction: null });
    expect(result.receipts[2]).toMatchObject({ kind: 'flower', quantity: 2, unitLabel: 'paquets', formatGrams: 5,
      revenueCents: 7000, netPayoutCents: 5200, feesCents: 175, costCents: null, satisfaction: 80 });
    expect(result.receiptsComplete).toBe(true);
  });

  it('filters unreadable dates without treating missing net proceeds as zero', () => {
    const data = state(); data.online!.recentSales = [flowerSale(), flowerSale({ id: 'bad', soldAt: 'invalid' })];
    Reflect.deleteProperty(data.online!.recentSales[0], 'netPayoutCents');
    const result = getKqShopActivity(data);
    expect(result.receipts).toHaveLength(1); expect(result.receipts[0].netPayoutCents).toBeNull(); expect(result.receiptsComplete).toBe(false);
  });

  it('deduplicates repeated receipt IDs within a circuit and marks the stream incomplete', () => {
    const data = state(); data.online!.recentSales = [flowerSale(), flowerSale()];
    const result = getKqShopActivity(data);
    expect(result.receipts).toHaveLength(1); expect(result.receiptsComplete).toBe(false);
  });

  it('keeps an actual zero cash receipt valid after taxes and debt repayment', () => {
    const data = state(); data.online!.recentSales = [flowerSale({ netPayoutCents: 0 })];
    const result = getKqShopActivity(data);
    expect(result.receipts[0].netPayoutCents).toBe(0); expect(result.receiptsComplete).toBe(true);
  });

  it('retains decimal satisfaction and zero fees instead of rounding them or dropping the receipt', () => {
    const data = state(); data.online!.recentSales = [flowerSale({ satisfaction: 74.65, feesCents: 0 })];
    const result = getKqShopActivity(data);
    expect(result.receipts[0]).toMatchObject({ satisfaction: 74.65, feesCents: 0 });
    expect(result.receiptsComplete).toBe(true);
  });

  it.each(['feesCents', 'satisfaction'] as const)('keeps a flower receipt with missing %s and marks that detail unknown', field => {
    const data = state(); data.online!.recentSales = [flowerSale()]; Reflect.deleteProperty(data.online!.recentSales[0], field);
    const result = getKqShopActivity(data);
    expect(result.receipts).toHaveLength(1); expect(result.receipts[0][field]).toBeNull();
    expect(result.receipts[0].netPayoutCents).toBe(5200); expect(result.receiptsComplete).toBe(false);
  });

  it('preserves a merch cash receipt without inferring an absent prepaid manufacturing cost', () => {
    const data = state(); data.online!.merch!.recentSales = [{ id: 'merch-cost', code: 'stickers', quantity: 1,
      soldAt: '2026-10-21T11:00:00Z', priceCents: 400, netPayoutCents: 290, feesCents: 10, costCents: 80 }];
    Reflect.deleteProperty(data.online!.merch!.recentSales[0], 'costCents');
    const result = getKqShopActivity(data);
    expect(result.receipts[0]).toMatchObject({ kind: 'merch', revenueCents: 400, netPayoutCents: 290, feesCents: 10, costCents: null });
    expect(result.receiptsComplete).toBe(false);
  });
});
