import { describe, expect, it } from 'vitest';
import { createKqOnlinePreview, getKqOnlineAudience, KQ_ONLINE_SITE_TIERS } from './kanab-quest-online';
import { estimateKqMerchOffer, getKqMerchModuleEligibility, getKqMerchSlots, KQ_MERCH_MODULES, KQ_MERCH_PRODUCTS } from './kanab-quest-merch';

function ready() {
  const online = createKqOnlinePreview(Date.parse('2026-10-20T12:00:00Z'));
  online.site.tier = 'studio'; online.stats.orders = 80; online.confidence = 70; online.upgrades.branding = true;
  return online;
}

describe('merchandise catalogue and purchase guidance', () => {
  it('defines six references with independent production costs and price references', () => {
    expect(KQ_MERCH_PRODUCTS.map(product => [product.code, product.unitCostCents, product.referencePriceCents])).toEqual([
      ['stickers', 80, 400], ['poster', 300, 1200], ['tote', 650, 1800], ['tshirt', 1100, 2800], ['mug', 550, 1600], ['cap', 850, 2200],
    ]);
    expect(KQ_MERCH_MODULES.map(module => [module.code, module.costCents])).toEqual([['paper', 12000], ['textile', 65000], ['objects', 95000]]);
  });

  it('initializes isolated data without giving stock, modules or revenue', () => {
    const merch = createKqOnlinePreview(0).merch!;
    expect(merch.version).toBe(1); expect(merch.modules).toEqual([]); expect(merch.inventory).toEqual([]); expect(merch.recentSales).toEqual([]);
    expect(Object.values(merch.stats).every(value => value === 0)).toBe(true);
  });

  it.each(KQ_ONLINE_SITE_TIERS)('limits $code to its actual number of active references', tier => {
    const online = ready(); online.site.tier = tier.code;
    expect(getKqMerchSlots(online)).toBe(tier.level === 1 ? 0 : tier.level);
  });

  it.each(KQ_MERCH_MODULES)('unlocks $code without requiring an unrelated collection', module => {
    const online = ready();
    expect(getKqMerchModuleEligibility(online, module.code, module.costCents)).toEqual({ allowed: true, blockers: [] });
    expect(online.merch!.modules).toEqual([]);
    online.merch!.modules.push(module.code);
    expect(getKqMerchModuleEligibility(online, module.code, module.costCents).allowed).toBe(false);
  });

  it.each(['site', 'branding', 'level', 'orders', 'confidence', 'cash', 'legacy', 'invalid-orders', 'invalid-confidence', 'invalid-cash'])('fails closed on missing %s requirement', reason => {
    const online = ready(); let cash = 95000;
    if (reason === 'site') online.site.active = false;
    if (reason === 'branding') online.upgrades.branding = false;
    if (reason === 'level') online.site.tier = 'pro';
    if (reason === 'orders') online.stats.orders = 79;
    if (reason === 'confidence') online.confidence = 69;
    if (reason === 'cash') cash--;
    if (reason === 'legacy') delete online.merch;
    if (reason === 'invalid-orders') online.stats.orders = NaN;
    if (reason === 'invalid-confidence') online.confidence = 101;
    if (reason === 'invalid-cash') cash = Infinity;
    const eligibility = getKqMerchModuleEligibility(online, 'objects', cash);
    expect(eligibility.allowed).toBe(false); expect(eligibility.blockers).not.toEqual([]);
  });
});

describe('merchandise demand and margin forecasts', () => {
  const forecast = (online = ready(), priceCents = 400, activeProductCount = 1) => estimateKqMerchOffer({ online, code: 'stickers', priceCents, reputation: 250, clients: 10, activeProductCount });

  it('uses organic audience, site conversion and confidence with real units', () => {
    const online = ready(); online.merch!.modules = ['paper'];
    const quote = forecast(online);
    const audience = getKqOnlineAudience({ online, reputation: 250, clients: 10, advertisingMultiplier: 1 });
    expect(quote.unitsPerDay).toBeCloseTo(audience * .04 * 1.9 * (.25 + .75 * .7) * 3, 10);
    expect(quote).toMatchObject({ referencePriceCents: 400, feesCents: 10, marginBeforeTaxCents: 310 });
    expect(forecast(online, 400, 2).unitsPerDay * 2).toBeCloseTo(quote.unitsPerDay, 10);
  });

  it('does not boost demand with photography, branding or an advertising campaign', () => {
    const online = ready(); online.merch!.modules = ['paper'];
    const before = forecast(online);
    online.upgrades.photography = true;
    online.marketing.active = { id: 'campaign', code: 'introduction', angle: 'value', startedAt: online.serverNow, endsAt: '2026-10-30T00:00:00Z' };
    expect(forecast(online)).toEqual(before);
  });

  it('trades faster turnover for unit margin instead of making expensive articles dominate', () => {
    const online = ready(); online.merch!.modules = ['paper', 'textile', 'objects'];
    const quotes = KQ_MERCH_PRODUCTS.map(product => ({ ...product, ...estimateKqMerchOffer({ online, code: product.code,
      priceCents: product.referencePriceCents, reputation: 250, clients: 10, activeProductCount: 1 }) }));
    const stickers = quotes.find(row => row.code === 'stickers')!, tshirt = quotes.find(row => row.code === 'tshirt')!;
    expect(stickers.unitsPerDay).toBeGreaterThan(tshirt.unitsPerDay * 4);
    expect(stickers.marginBeforeTaxCents).toBeLessThan(tshirt.marginBeforeTaxCents);
    const dailyAfterVatBeforeDebt = quotes.map(row => row.unitsPerDay * (row.marginBeforeTaxCents - row.referencePriceCents / 6));
    expect(Math.max(...dailyAfterVatBeforeDebt) / Math.min(...dailyAfterVatBeforeDebt)).toBeLessThan(1.2);
  });

  it('does not promise sales for unavailable or locked merchandise', () => {
    const online = ready();
    expect(forecast(online).unitsPerDay).toBe(0);
    online.merch!.modules = ['paper']; online.site.active = false;
    expect(forecast(online).unitsPerDay).toBe(0);
    online.site.active = true; delete online.merch;
    expect(forecast(online).unitsPerDay).toBe(0);
  });

  it('accepts a loss-making price, but zero demand at an absurd markup', () => {
    const online = ready(); online.merch!.modules = ['paper'];
    expect(forecast(online, 1).marginBeforeTaxCents).toBe(-79);
    expect(forecast(online, 1000).unitsPerDay).toBe(0);
    expect(forecast(online, 600).unitsPerDay).toBeLessThan(forecast(online, 400).unitsPerDay);
  });

  it.each([NaN, Infinity, 0, -1, 1.2, 100001])('rejects invalid cents %s', priceCents => {
    expect(() => forecast(ready(), priceCents)).toThrow('prix');
  });

  it('never emits nonfinite demand for malformed context', () => {
    const online = ready(); online.merch!.modules = ['paper'];
    expect(estimateKqMerchOffer({ online, code: 'stickers', priceCents: 400, reputation: NaN, clients: 10 }).unitsPerDay).toBe(0);
    expect(estimateKqMerchOffer({ online, code: 'stickers', priceCents: 400, reputation: 0, clients: Infinity }).unitsPerDay).toBe(0);
    expect(forecast(online, 400, 0).unitsPerDay).toBe(0);
  });
});
