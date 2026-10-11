import { describe, expect, it } from "vitest";
import { createKqOnlinePreview, estimateKqOnlineOffer, getKqOnlineAudience, getKqOnlinePriceAcceptance, getKqOnlineSatisfaction, getKqOnlineUpgradeCost, getKqOnlineSaleableHours, KQ_ONLINE_PACKAGING } from "./kanab-quest-online";
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

describe("Immediate shop purchases", () => {
  const stock: KqCommerceStock = { id: "stock", flowerId: "flower", name: "Récolte", route: "raw", batchRoute: "raw", juryScore: 8,
    initialUnits: 10000, remainingUnits: 10000, equivalentUnits: 10000, originalUnits: 10000, baseUnitCents: 180,
    repExact: 0, repRounded: 0, professionalUnits: 0, counted: false };
  const state: KqCommerceState = { online: createKqOnlinePreview(now), revision: 0, cashCents: 100000, reputation: 0, clients: 0,
    computerOwned: true, internetRenew: false, stocks: [stock], receipts: [], marketVolumes: {}, ownVolumes: {}, routeSales: {},
    campaign: { id: "campaign", revision: 0, reputation: 0, clientsStart: 0, internetPaid: true, event: "normal", directUsed: 0, shopUsed: 0, goodUnits: 0, disappointmentUnits: 0 } };

  it("buys flowers from 500 to 1500 euros per kg solely according to quality", () => {
    for (const [quality, unitCents] of [[6.5, 50], [8, 100], [9.5, 150], [10, 150]]) {
      const result = quoteKqCommerce(state, { ...stock, juryScore: quality }, "cbd-shop", "advised", 100);
      expect(result.unitCents).toBe(unitCents);
      expect(result.payoutCents).toBe(10 * unitCents);
      expect(result.retailPriceCentsPerKg).toBe(1000 * unitCents);
    }
    expect(quoteKqCommerce(state, { ...stock, juryScore: 6.49 }, "cbd-shop").maxUnits).toBe(0);
  });

  it("increases volume with merchant talent and network without breaching the price cap", () => {
    const established = { ...state, strength: "merchant" as const, shopPartners: 20, campaign: { ...state.campaign!, shopPartnersStart: 20 } };
    expect(quoteKqCommerce(established, stock, "cbd-shop").unitCents).toBe(100);
    expect(quoteKqCommerce(established, stock, "cbd-shop").maxUnits).toBeGreaterThan(quoteKqCommerce(state, stock, "cbd-shop").maxUnits);
    expect(quoteKqCommerce(established, stock, "wholesale").unitCents).toBeLessThanOrEqual(60);
    expect(quoteKqCommerce(state, stock, "online").maxUnits).toBe(0);
  });

  it("preserves extraction tariffs and historical snapshots", () => {
    const old = { ...state, online: undefined };
    const extract = { ...stock, route: "dry-sift" as const, batchRoute: "dry-sift" as const, juryScore: 9, baseUnitCents: 900 };
    expect(quoteKqCommerce(state, extract, "cbd-shop")).toEqual(quoteKqCommerce(old, extract, "cbd-shop"));
    expect(quoteKqCommerce(old, stock, "online").maxUnits).toBeGreaterThan(0);
  });
});
