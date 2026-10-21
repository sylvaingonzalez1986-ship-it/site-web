import { describe, expect, it } from 'vitest';
import { createKqOnlinePreview, estimateKqOnlineOffer, getKqOnlineAudience } from './kanab-quest-online';
import { estimateKqMerchOffer } from './kanab-quest-merch';
import { createKqCustomerDemandSnapshot } from './kanab-quest-customer-demand';
import { KQ_STUDIO_LEVELS, getKqStudioEditorialFit, getKqStudioEligibility, getKqStudioFlowerMultiplier, getKqStudioLevels, getKqStudioMerchMultiplier, getKqStudioStyle, type KqStudioTrack } from './kanab-quest-studio';

function ready() {
  const online = createKqOnlinePreview(Date.parse('2026-10-20T12:00:00Z'));
  online.site.tier = 'flagship'; online.stats.orders = 350; online.confidence = 90;
  return online;
}

describe('studio progression and compatibility', () => {
  it('initializes without granting acquired work, sales or a bonus', () => {
    const online = ready();
    expect(online.studio).toEqual({ version: 1, levels: { photography: 0, branding: 0, editorial: 0 }, style: 'craft' });
    expect(getKqStudioFlowerMultiplier(online, 9, 1)).toBe(1);
    expect(getKqStudioMerchMultiplier(online, 'mug', 1)).toBe(1);
  });

  it('preserves original purchases in legacy and migrated snapshots without stacking twice', () => {
    const online = ready(); online.upgrades = { photography: true, branding: true };
    expect(getKqStudioLevels(online)).toEqual({ photography: 1, branding: 1, editorial: 0 });
    expect(getKqStudioFlowerMultiplier(online, 9, 1)).toBeCloseTo(1.1 * 1.08, 10);
    delete online.studio;
    expect(getKqStudioLevels(online)).toEqual({ photography: 1, branding: 1, editorial: 0 });
    expect(getKqStudioStyle(online)).toBe('craft');
    expect(getKqStudioMerchMultiplier(online, 'mug', 1)).toBe(1);
  });

  it('does not accept malformed stored levels as an unearned multiplier', () => {
    const online = ready(); online.upgrades.photography = true;
    online.studio!.levels = { photography: -1, branding: 99, editorial: NaN };
    expect(getKqStudioLevels(online)).toEqual({ photography: 1, branding: 0, editorial: 0 });
    online.studio!.levels = { photography: Infinity, branding: .5, editorial: -5 };
    expect(getKqStudioLevels(online)).toEqual({ photography: 1, branding: 0, editorial: 0 });
  });

  it.each(KQ_STUDIO_LEVELS)('offers $track $level at its incremental price when all requirements are met', target => {
    const online = ready();
    online.studio!.levels = { photography: 3, branding: 3, editorial: 3, [target.track]: target.level - 1 };
    expect(getKqStudioEligibility(online, target.track, target.level, target.costCents)).toEqual({ allowed: true, costCents: target.costCents, blockers: [] });
    expect(getKqStudioEligibility(online, target.track, target.level, target.costCents - 1).allowed).toBe(false);
    online.studio!.levels[target.track] = target.level;
    expect(getKqStudioEligibility(online, target.track, target.level, target.costCents).allowed).toBe(false);
  });

  it.each(['legacy', 'site', 'created', 'level', 'orders', 'confidence', 'photo', 'brand', 'cash', 'invalid-orders', 'invalid-confidence', 'invalid-cash'])('rejects editorial3 with missing %s', reason => {
    const online = ready(); online.studio!.levels = { photography: 2, branding: 2, editorial: 2 }; let cash = 95000;
    if (reason === 'legacy') delete online.studio;
    if (reason === 'site') online.site.active = false;
    if (reason === 'created') online.site.createdAt = null;
    if (reason === 'level') online.site.tier = 'pro';
    if (reason === 'orders') online.stats.orders = 79;
    if (reason === 'confidence') online.confidence = 74;
    if (reason === 'photo') online.studio!.levels.photography = 1;
    if (reason === 'brand') online.studio!.levels.branding = 1;
    if (reason === 'cash') cash--;
    if (reason === 'invalid-orders') online.stats.orders = NaN;
    if (reason === 'invalid-confidence') online.confidence = 101;
    if (reason === 'invalid-cash') cash = Infinity;
    expect(getKqStudioEligibility(online, 'editorial', 3, cash).allowed).toBe(false);
  });

  it('allows only the two old first levels through the legacy purchase flow', () => {
    const online = ready(); delete online.studio;
    expect(getKqStudioEligibility(online, 'photography', 1, 30000).allowed).toBe(true);
    expect(getKqStudioEligibility(online, 'branding', 1, 70000).allowed).toBe(true);
    online.upgrades.photography = true;
    expect(getKqStudioEligibility(online, 'editorial', 1, 18000).allowed).toBe(false);
    expect(getKqStudioEligibility(online, 'photography', 2, 55000).allowed).toBe(false);
    expect(getKqStudioEligibility(online, 'unknown', 1, 100000).costCents).toBeNull();
    expect(getKqStudioEligibility(online, 'photography', 4, 100000).costCents).toBeNull();
  });

  it('does not skip the previous step even with enough money and a high site level', () => {
    const online = ready();
    expect(getKqStudioEligibility(online, 'photography', 3, 1000000).allowed).toBe(false);
    online.studio!.levels.photography = 3;
    expect(getKqStudioEligibility(online, 'photography', 1, 1000000).allowed).toBe(false);
  });
});

describe('studio conversion and editorial tradeoffs', () => {
  it.each([
    ['clear', 5.8, 1.05, 'stickers', true], ['clear', 9, 1.051, 'poster', false],
    ['craft', 7.5, 1.3, 'tote', true], ['craft', 7.49, 1.3, 'stickers', false],
    ['signature', 8.5, 1, 'tshirt', true], ['signature', 9, 1.5, 'cap', true],
    ['signature', 8.49, 1.5, 'mug', false], ['signature', 9, .99, 'tshirt', false],
    ['signature', 9, 1.501, 'cap', false], ['clear', 9, Infinity, 'stickers', false],
  ] as const)('matches the %s offer at quality %s and ratio %s', (style, quality, priceRatio, merchCode, matched) => {
    const online = ready(); online.studio!.style = style; online.studio!.levels.editorial = 3;
    expect(getKqStudioEditorialFit(online, { quality, priceRatio })).toEqual({ matched, multiplier: matched ? 1.12 : .94 });
    expect(getKqStudioEditorialFit(online, { merchCode, priceRatio })).toEqual({ matched, multiplier: matched ? 1.12 : .94 });
  });

  it('applies no editorial reward or penalty before the first editorial level', () => {
    const online = ready();
    expect(getKqStudioEditorialFit(online, { quality: 9, priceRatio: 1 }).multiplier).toBe(1);
    expect(getKqStudioEditorialFit(online, { quality: 6, priceRatio: 2 }).multiplier).toBe(1);
    for (const level of [1, 2, 3]) {
      online.studio!.levels.editorial = level;
      expect(getKqStudioEditorialFit(online, { quality: 9, priceRatio: 1 }).multiplier).toBeCloseTo(1 + .04 * level);
      expect(getKqStudioEditorialFit(online, { quality: 6, priceRatio: 2 }).multiplier).toBeCloseTo(1 - .02 * level);
    }
  });

  it.each(['photography', 'branding', 'editorial'] as KqStudioTrack[])('changes flower conversion through %s without changing audience, satisfaction or price reference', track => {
    const online = ready();
    const input = { online, quality: 9, baseUnitCents: 300, formatGrams: 5 as const, packagingCode: 'kraft-5', packetPriceCents: 1800, reputation: 200, clients: 10 };
    const initial = estimateKqOnlineOffer(input);
    online.studio!.levels[track] = 3;
    const improved = estimateKqOnlineOffer(input);
    expect(improved.ordersPerDay / initial.ordersPerDay).toBeCloseTo(getKqStudioFlowerMultiplier(online, 9, initial.priceRatio), 10);
    expect(improved.referencePacketPriceCents).toBe(initial.referencePacketPriceCents);
    expect(improved.visitorsPerDay).toBe(initial.visitorsPerDay);
    expect(improved.satisfaction).toBe(initial.satisfaction);
    expect(improved.netBeforeProductionCents).toBe(initial.netBeforeProductionCents);
    expect(online.confidence).toBe(90); expect(online.followers).toBe(0);
  });

  it('boosts merch only through advanced identity and relevant editorial work', () => {
    const online = ready(); online.upgrades.branding = true; online.merch!.modules = ['paper']; online.studio!.style = 'clear';
    const forecast = () => estimateKqMerchOffer({ online, code: 'stickers', priceCents: 400, reputation: 200, clients: 10, activeProductCount: 1 });
    const initial = forecast(), audience = getKqOnlineAudience({ online, reputation: 200, clients: 10 });
    online.studio!.levels.photography = 3;
    expect(forecast()).toEqual(initial);
    online.studio!.levels.branding = 3; online.studio!.levels.editorial = 3;
    expect(forecast().unitsPerDay / initial.unitsPerDay).toBeCloseTo(1.16 * 1.12, 10);
    expect(forecast().referencePriceCents).toBe(initial.referencePriceCents);
    expect(forecast().marginBeforeTaxCents).toBe(initial.marginBeforeTaxCents);
    expect(getKqOnlineAudience({ online, reputation: 200, clients: 10 })).toBe(audience);
    online.studio!.style = 'signature';
    expect(forecast().unitsPerDay / initial.unitsPerDay).toBeCloseTo(1.16 * .94, 10);
  });

  it('matches against the customer-demand price reference and rechecks when its quota expires', () => {
    const online = ready(); online.studio!.style = 'clear';
    const customerDemand = createKqCustomerDemandSnapshot(Date.parse(online.serverNow));
    const request = customerDemand.requests.find(item => item.channel === 'online')!;
    const input = { online, route: 'raw' as const, varietyCode: request.varietyCode, customerDemand, quality: 9,
      baseUnitCents: 300, formatGrams: 5 as const, packagingCode: 'kraft-5', packetPriceCents: 4201, reputation: 200, clients: 10 };
    const baseline = estimateKqOnlineOffer(input);
    online.studio!.levels.editorial = 3;
    const matched = estimateKqOnlineOffer(input);
    expect(matched.priceRatio).toBeLessThan(1.05);
    expect(matched.ordersPerDay / baseline.ordersPerDay).toBeCloseTo(1.12, 10);
    request.remainingUnits = 0;
    const depleted = estimateKqOnlineOffer(input);
    online.studio!.levels.editorial = 0;
    const depletedBaseline = estimateKqOnlineOffer(input);
    expect(depleted.priceRatio).toBeGreaterThan(1.05);
    expect(depleted.ordersPerDay / depletedBaseline.ordersPerDay).toBeCloseTo(.94, 10);
    expect(depleted.referencePacketPriceCents).toBe(depletedBaseline.referencePacketPriceCents);
  });
});
