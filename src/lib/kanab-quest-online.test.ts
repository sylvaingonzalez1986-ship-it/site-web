import { describe, expect, it } from "vitest";
import { createKqOnlinePreview, estimateKqOnlineOffer, getKqOnlineAudience, getKqOnlinePriceAcceptance, getKqOnlineSatisfaction, getKqOnlineUpgradeCost, getKqOnlineSaleableHours, getKqOnlineTierEligibility, KQ_ONLINE_PACKAGING, KQ_ONLINE_SITE_TIERS, type KqOnlineSiteTier } from "./kanab-quest-online";
import { createKqBusinessPreview, isKqShopActive } from "./kanab-quest-business";
import { quoteKqCommerce, type KqCommerceState, type KqCommerceStock } from "./kanab-quest-commerce";

const now = Date.parse("2026-10-11T12:00:00Z");
function forecast(overrides: Partial<Parameters<typeof estimateKqOnlineOffer>[0]> = {}) {
  return estimateKqOnlineOffer({ quality: 8, baseUnitCents: 180, formatGrams: 5, packagingCode: "kraft-5", packetPriceCents: 1015,
    reputation: 0, clients: 0, online: createKqOnlinePreview(now), ...overrides });
}

describe("Progressive online commerce", () => {
  it("starts below two orders per real day, without an initial audience or guaranteed sale", () => {
    const first = forecast();
    expect(first.visitorsPerDay).toBe(24);
    expect(first.ordersPerDay).toBeGreaterThan(0);
    expect(first.ordersPerDay).toBeLessThan(2);
    expect(forecast({ packetPriceCents: 1000000 }).ordersPerDay).toBe(0);
    expect(forecast({ packetPriceCents: 0 }).ordersPerDay).toBe(0);
    expect(forecast({ packetPriceCents: 1.2 }).ordersPerDay).toBe(0);
  });

  it("decreases demand continuously when the exact asking price rises", () => {
    let previous = Infinity;
    for (let ratio = 0; ratio <= 3; ratio += .001) {
      const acceptance = getKqOnlinePriceAcceptance(ratio);
      expect(acceptance).toBeLessThanOrEqual(previous);
      expect(acceptance).toBeGreaterThanOrEqual(0);
      previous = acceptance;
    }
    for (const point of [1, 1.25, 2.5]) {
      expect(getKqOnlinePriceAcceptance(point - 1e-7)).toBeCloseTo(getKqOnlinePriceAcceptance(point + 1e-7), 5);
    }
  });

  it("rewards fair value and cannot disguise an overpriced lot with a premium jar", () => {
    expect(getKqOnlineSatisfaction(6.5, .9)).toBeGreaterThanOrEqual(75);
    expect(getKqOnlineSatisfaction(6.5, 1.5, 8)).toBeLessThan(60);
    expect(getKqOnlineSatisfaction(9, 1, 8)).toBeGreaterThan(getKqOnlineSatisfaction(9, 1, 0));
    const premium = { ...createKqOnlinePreview(now), confidence: 100 };
    expect(forecast({ reputation: 100000, online: premium, packetPriceCents: 1000000 }).ordersPerDay).toBe(0);
  });

  it("shares one audience among listings and normalizes 5 g and 10 g demand", () => {
    const one = forecast();
    expect(forecast({ activeListingCount: 8 }).ordersPerDay * 8).toBeCloseTo(one.ordersPerDay, 8);
    const ten = forecast({ formatGrams: 10, packagingCode: "kraft-10", packetPriceCents: 2010 });
    expect(ten.gramsPerDay).toBeCloseTo(one.gramsPerDay, 8);
    expect(ten.ordersPerDay * 2).toBeCloseTo(one.ordersPerDay, 8);
  });

  it("distinguishes followers, traffic, conversion and confidence", () => {
    const first = forecast();
    const online = createKqOnlinePreview(now);
    online.upgrades.photography = true;
    online.site.tier = "pro";
    expect(forecast({ online }).visitorsPerDay).toBe(first.visitorsPerDay);
    expect(forecast({ online }).ordersPerDay).toBeGreaterThan(first.ordersPerDay);
    online.confidence = 5;
    expect(forecast({ online }).ordersPerDay).toBeLessThan(first.ordersPerDay);
    online.followers = 100;
    expect(getKqOnlineAudience({ online, reputation: 0, clients: 0 })).toBe(36);
  });

  it("only adds marketing visitors during the campaign and never grants clients", () => {
    const online = createKqOnlinePreview(now);
    online.marketing.active = { id: "mission", code: "introduction", angle: "craft", startedAt: new Date(now).toISOString(), endsAt: new Date(now + 86400000).toISOString() };
    expect(forecast({ online }).visitorsPerDay).toBe(59);
    online.serverNow = online.marketing.active.endsAt;
    expect(forecast({ online }).visitorsPerDay).toBe(24);
    expect(online.followers).toBe(0);
  });

  it("requires mature quality, an active site and branding for printed packs", () => {
    expect(forecast({ quality: 5.79 }).ordersPerDay).toBe(0);
    expect(forecast({ packagingCode: "printed-5" }).ordersPerDay).toBe(0);
    expect(() => forecast({ packagingCode: "glass-10" })).toThrow(/format/);
    const online = createKqOnlinePreview(now);
    online.site.active = false;
    expect(forecast({ online }).ordersPerDay).toBe(0);
  });

  it("warns when a barely eligible lot can age out before its first order", () => {
    expect(getKqOnlineSaleableHours(5.8, "kraft-5")).toBe(4);
    expect(getKqOnlineSaleableHours(5.81, "kraft-5")).toBe(8);
    expect(getKqOnlineSaleableHours(5.81, "glass-5")).toBe(12);
    expect(getKqOnlineSaleableHours(5.79, "glass-5")).toBe(0);
    expect(getKqOnlineSaleableHours(6, "glass-5")).toBeGreaterThan(getKqOnlineSaleableHours(6, "kraft-5"));
  });

  it("shows contribution after packaging and fees without claiming it is total profit", () => {
    const offer = forecast({ packetPriceCents: 1200 });
    expect(offer.feeCents).toBe(30);
    expect(offer.packagingCostCents).toBe(25);
    expect(offer.netBeforeProductionCents).toBe(945);
    expect(KQ_ONLINE_PACKAGING.map(item => item.unitCostCents)).toEqual([25, 30, 110, 125, 180, 210]);
    expect(getKqOnlineUpgradeCost("improved", "pro")).toBe(210000);
  });

  it("keeps a free basic site active without a fictitious renewal date", () => {
    const business = createKqBusinessPreview(now);
    business.shop = { name: "Mon shop", createdAt: new Date(now).toISOString(), paidUntil: null, active: true, renew: false, tier: "basic", monthlyCents: 0 };
    expect(isKqShopActive(business, now + 100 * 86400000)).toBe(true);
    business.shop.tier = "improved";
    expect(isKqShopActive(business, now)).toBe(false);
  });
});

describe("Six successive online shop levels", () => {
  function established() {
    const online = createKqOnlinePreview(now);
    online.site.tier = "pro";
    online.stats.orders = 350;
    online.confidence = 88;
    online.followers = 300;
    online.upgrades = { photography: true, branding: true };
    return online;
  }

  it("preserves the original tariffs and introduces differential costs without repurchasing previous levels", () => {
    expect(KQ_ONLINE_SITE_TIERS.map(tier => tier.level)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(KQ_ONLINE_SITE_TIERS.slice(0, 3).map(tier => [tier.code, tier.acquisitionCents, tier.monthlyCents,
      tier.conversionMultiplier, tier.minimumOrders, tier.minimumConfidence, tier.minimumFollowers, tier.requiredUpgrades]))
      .toEqual([["basic", 0, 0, 1, 0, 0, 0, []], ["improved", 90000, 3000, 1.25, 5, 45, 0, []], ["pro", 300000, 6000, 1.6, 30, 60, 0, []]]);
    expect(KQ_ONLINE_SITE_TIERS.slice(1).map((tier, index) => getKqOnlineUpgradeCost(KQ_ONLINE_SITE_TIERS[index].code, tier.code)))
      .toEqual([90000, 210000, 350000, 550000, 800000]);
    expect(KQ_ONLINE_SITE_TIERS.map(tier => tier.monthlyCents)).toEqual([0, 3000, 6000, 11000, 18000, 28000]);
  });

  it("reports every concrete obstacle without modifying the snapshot", () => {
    const online = established();
    online.site.tier = "improved";
    online.stats.orders = 79; online.confidence = 69; online.followers = 49;
    online.upgrades.photography = false;
    const before = structuredClone(online);
    const eligibility = getKqOnlineTierEligibility(online, "studio", 559999);
    expect(eligibility).toMatchObject({ allowed: false, costCents: 560000, nextTier: "pro" });
    expect(eligibility.blockers).toEqual([
      expect.objectContaining({ code: "sequence", actual: 2, required: 3 }),
      expect.objectContaining({ code: "orders", actual: 79, required: 80 }),
      expect.objectContaining({ code: "confidence", actual: 69, required: 70 }),
      expect.objectContaining({ code: "followers", actual: 49, required: 50 }),
      expect.objectContaining({ code: "upgrade", upgrade: "photography" }),
      expect.objectContaining({ code: "cash", actual: 559999, required: 560000 }),
    ]);
    expect(online).toEqual(before);
  });

  it.each(KQ_ONLINE_SITE_TIERS.slice(1))("accepts exact thresholds and exact differential cash for $code", target => {
    const online = established();
    online.site.tier = KQ_ONLINE_SITE_TIERS[target.level - 2].code;
    online.stats.orders = target.minimumOrders;
    online.confidence = target.minimumConfidence;
    online.followers = target.minimumFollowers;
    online.upgrades = { photography: false, branding: false };
    for (const code of target.requiredUpgrades) online.upgrades[code] = true;
    const costCents = getKqOnlineUpgradeCost(online.site.tier, target.code);
    expect(getKqOnlineTierEligibility(online, target.code, costCents))
      .toEqual({ allowed: true, costCents, nextTier: target.code, blockers: [] });
    expect(getKqOnlineTierEligibility(online, target.code, costCents - 1).blockers.map(blocker => blocker.code)).toEqual(["cash"]);
  });

  it("allows only the immediately following level even with abundant money and established demand", () => {
    const online = established();
    for (const target of ["basic", "improved", "pro", "signature", "flagship"] as const) {
      const result = getKqOnlineTierEligibility(online, target, 20_000_000);
      expect(result.allowed).toBe(false);
      expect(result.blockers.map(blocker => blocker.code)).toEqual(["sequence"]);
    }
    online.site.tier = "flagship";
    expect(getKqOnlineTierEligibility(online, "flagship", 20_000_000)).toMatchObject({ allowed: false, nextTier: null });
  });

  it("keeps historical pro snapshots readable while requiring declared availability for new purchases", () => {
    const online = established();
    delete online.site.maxLevel;
    expect(getKqOnlineTierEligibility(online, "studio", 350000).blockers.map(blocker => blocker.code)).toEqual(["unavailable"]);
    expect(forecast({ online }).ordersPerDay).toBeGreaterThan(0);
    online.site.tier = "improved";
    expect(getKqOnlineTierEligibility(online, "pro", 210000).allowed).toBe(true);
    online.site.maxLevel = 4;
    online.site.tier = "pro";
    expect(getKqOnlineTierEligibility(online, "studio", 350000).allowed).toBe(true);
    expect(createKqOnlinePreview(now).site.maxLevel).toBe(6);
  });

  it.each([NaN, Infinity, -1, 1.5])("blocks malformed counts or money (%s) instead of treating them as sufficient", invalid => {
    const online = established();
    online.stats.orders = invalid; online.followers = invalid;
    const result = getKqOnlineTierEligibility(online, "studio", invalid);
    expect(result.allowed).toBe(false);
    expect(result.blockers).toEqual([
      expect.objectContaining({ code: "orders", actual: null }),
      expect.objectContaining({ code: "followers", actual: null }),
      expect.objectContaining({ code: "cash", actual: null }),
    ]);
  });

  it.each([NaN, Infinity, -1, 101])("blocks invalid confidence (%s)", confidence => {
    const online = established(); online.confidence = confidence;
    expect(getKqOnlineTierEligibility(online, "studio", 350000).blockers)
      .toEqual([expect.objectContaining({ code: "confidence", actual: null })]);
  });

  it("does not silently interpret unknown tiers or non-finite availability as a basic site", () => {
    const online = established();
    expect(getKqOnlineTierEligibility(online, "unknown" as KqOnlineSiteTier, 350000))
      .toMatchObject({ allowed: false, costCents: null, blockers: [{ code: "tier" }] });
    online.site.maxLevel = Infinity;
    expect(getKqOnlineTierEligibility(online, "studio", 350000).blockers.map(blocker => blocker.code)).toEqual(["unavailable"]);
    online.site.tier = "unknown" as KqOnlineSiteTier;
    expect(getKqOnlineTierEligibility(online, "studio", 350000)).toMatchObject({ allowed: false, nextTier: null, costCents: null });
  });

  it.each(KQ_ONLINE_SITE_TIERS)("changes only conversion for $code, without creating traffic, quality or a guaranteed order", tier => {
    const online = established();
    online.site.tier = "basic";
    const baseline = forecast({ online });
    online.site.tier = tier.code;
    const before = structuredClone(online);
    const offer = forecast({ online });
    expect(offer.ordersPerDay).toBeCloseTo(baseline.ordersPerDay * tier.conversionMultiplier, 8);
    expect(offer.visitorsPerDay).toBe(baseline.visitorsPerDay);
    expect(offer.referencePacketPriceCents).toBe(baseline.referencePacketPriceCents);
    expect(offer.satisfaction).toBe(baseline.satisfaction);
    expect(offer.feeCents).toBe(baseline.feeCents);
    expect(forecast({ online, quality: 5.79 }).ordersPerDay).toBe(0);
    expect(forecast({ online, packetPriceCents: 1_000_000 }).ordersPerDay).toBe(0);
    online.site.active = false;
    expect(forecast({ online }).ordersPerDay).toBe(0);
    online.site.active = true;
    expect(online).toEqual(before);
  });
});

describe("Immediate shop purchases", () => {
  const stock: KqCommerceStock = { id: "stock", flowerId: "flower", name: "Récolte", route: "raw", batchRoute: "raw", juryScore: 8,
    initialUnits: 10000, remainingUnits: 10000, equivalentUnits: 10000, originalUnits: 10000, baseUnitCents: 180,
    repExact: 0, repRounded: 0, professionalUnits: 0, counted: false };
  const state: KqCommerceState = { online: createKqOnlinePreview(now), revision: 0, cashCents: 100000, reputation: 0, clients: 0,
    computerOwned: true, internetRenew: false, stocks: [stock], receipts: [], marketVolumes: {}, ownVolumes: {}, routeSales: {},
    campaign: { id: "campaign", revision: 0, reputation: 0, clientsStart: 0, internetPaid: true, event: "normal", directUsed: 0, shopUsed: 0, goodUnits: 0, disappointmentUnits: 0 } };

  it("buys saleable indoor flowers at three euros per gram", () => {
    for (const [quality, unitCents] of [[6.5, 300], [8, 300], [9.5, 300], [10, 300]]) {
      const result = quoteKqCommerce(state, { ...stock, juryScore: quality }, "cbd-shop", "advised", 100);
      expect(result.unitCents).toBe(unitCents);
      expect(result.payoutCents).toBe(10 * unitCents);
      expect(result.retailPriceCentsPerKg).toBe(1000 * unitCents);
    }
    expect(quoteKqCommerce(state, { ...stock, juryScore: 6.49 }, "cbd-shop").maxUnits).toBe(0);
  });

  it("increases volume with merchant talent and network without breaching the price cap", () => {
    const established = { ...state, strength: "merchant" as const, shopPartners: 20, campaign: { ...state.campaign!, shopPartnersStart: 20 } };
    expect(quoteKqCommerce(established, stock, "cbd-shop").unitCents).toBe(300);
    expect(quoteKqCommerce(established, stock, "cbd-shop").maxUnits).toBeGreaterThan(quoteKqCommerce(state, stock, "cbd-shop").maxUnits);
    expect(quoteKqCommerce(established, stock, "wholesale").unitCents).toBe(210);
    expect(quoteKqCommerce(state, stock, "online").maxUnits).toBe(0);
  });

  it("preserves extraction tariffs and historical snapshots", () => {
    const old = { ...state, online: undefined };
    const extract = { ...stock, route: "dry-sift" as const, batchRoute: "dry-sift" as const, juryScore: 9, baseUnitCents: 900 };
    expect(quoteKqCommerce(state, extract, "cbd-shop")).toEqual(quoteKqCommerce(old, extract, "cbd-shop"));
    expect(quoteKqCommerce(old, stock, "online").maxUnits).toBeGreaterThan(0);
  });
});
