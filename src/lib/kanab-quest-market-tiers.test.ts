import { describe, expect, it } from "vitest";
import { KQ_EQUIPMENT_CATALOG } from "./kanab-quest-equipment";
import { calculateKqMarketReputation, getKqRouteExpertiseBonusReputation, KQ_MARKET_ROUTES, quoteKqMarketRoutes, type KqMarketRouteCode } from "./kanab-quest-market";
import { KQ_MARKET_REPUTATION_TIERS, getKqMarketReputationProgress, type KqMarketContext } from "./kanab-quest-market-demand";
import { KQ_REPUTATION_TIERS } from "./kanab-quest-reputation";

const equipmentCodes = KQ_EQUIPMENT_CATALOG.map((item) => item.code);
const equipmentLevels = Object.fromEntries(equipmentCodes.map((code) => [code, 10]));
const context: KqMarketContext = { reputation: 0, routeSales: { "dry-sift": 12, "rosin-trial": 12 }, recentSales: {}, marketVolumes: {}, window: 2 };
const quotes = (reputation: number, score = 9, extra: Partial<KqMarketContext> = {}) => quoteKqMarketRoutes({
  juryScore: score, harvestGrams: 120, equipmentCodes, equipmentLevels, marketContext: { ...context, ...extra, reputation },
});
const raw = (reputation: number) => quotes(reputation, 5.8, { recentSales: { raw: 10 }, marketVolumes: { raw: 20 } }).find((q) => q.route === "raw")!;

describe("Reputation tiers and loyal market buyers", () => {
  it("uses the existing titles and exact thresholds, with stable benefits inside each tier", () => {
    expect(KQ_MARKET_REPUTATION_TIERS.map(({ code, name, minimum }) => ({ code, name, minimum }))).toEqual(KQ_REPUTATION_TIERS);
    for (let i = 1; i < KQ_MARKET_REPUTATION_TIERS.length; i++) {
      const tier = KQ_MARKET_REPUTATION_TIERS[i];
      expect(getKqMarketReputationProgress(tier.minimum - 1).tier).toEqual(KQ_MARKET_REPUTATION_TIERS[i - 1]);
      expect(getKqMarketReputationProgress(tier.minimum).tier).toEqual(tier);
      expect(raw(tier.minimum).payoutCents).toBeGreaterThan(raw(tier.minimum - 1).payoutCents);
    }
    expect(raw(60).payoutCents).toBe(raw(199).payoutCents);
    expect(getKqMarketReputationProgress(599).pointsToNext).toBe(1);
    expect(getKqMarketReputationProgress(3000).nextTier).toBeNull();
    expect(raw(100001).market!.reputation).toBe(100001);
    for (const invalid of [-1, NaN, Infinity]) expect(getKqMarketReputationProgress(invalid).tier.minimum).toBe(0);
  });

  it("guarantees fair sales at 600 and premium sales at 1500, removing guarantees if reputation drops", () => {
    expect(raw(599).market!.offers[1].accepted).toBe(false);
    expect(raw(600).market!.offers[1].accepted).toBe(true);
    expect(raw(1499).market!.offers[2].accepted).toBe(false);
    expect(raw(1500).market!.offers[2].accepted).toBe(true);
    expect(raw(1500).market!.offers[2].message).toContain("clientèle fidèle");
  });

  it("guarantees premium sales of every eligible product at minimum quality, in every trend and maximal saturation", () => {
    for (const reputation of [1500, 3000]) for (let window = 0; window < 6; window++) {
      for (const route of quotes(reputation)) {
        if (route.family === "salvage") continue;
        const sold = quotes(reputation, route.minimumJuryScore, { window, recentSales: { [route.route]: 10 }, marketVolumes: { [route.route]: 20 } }).find((q) => q.route === route.route)!;
        expect(sold.market!.saturation).toBe(45);
        expect(sold.available, route.route).toBe(true);
        expect(sold.market!.offers[2].accepted, route.route).toBe(true);
        expect(sold.market!.offers[2].payoutCents).toBeGreaterThan(sold.market!.offers[1].payoutCents);
      }
    }
  });

  it("protects premium clientele prices from saturation and downturns while keeping favorable trends and quality valuable", () => {
    for (const reputation of [1500, 3000]) {
      const neutral = quotes(reputation).find((q) => q.route === "raw")!;
      const saturated = raw(reputation);
      const sameQuality = quotes(reputation, 5.8).find((q) => q.route === "raw")!;
      expect(saturated.payoutCents).toBe(sameQuality.payoutCents);
      expect(neutral.payoutCents).toBeGreaterThan(sameQuality.payoutCents);
      expect(quotes(reputation, 9, { window: 1 }).find((q) => q.route === "raw")!.payoutCents).toBe(neutral.payoutCents);
      expect(quotes(reputation, 9, { window: 0 }).find((q) => q.route === "raw")!.payoutCents).toBeGreaterThan(neutral.payoutCents);
    }
  });

  it("does not bypass quality, equipment or family experience, and never inflates biomass prices", () => {
    for (const route of quotes(3000).filter((q) => q.family !== "salvage")) {
      const below = quotes(3000, route.minimumJuryScore - 0.1).find((q) => q.route === route.route)!;
      expect(below.market!.offers.every((offer) => !offer.accepted)).toBe(true);
    }
    for (const overrides of [{ equipmentCodes: [] }, { equipmentLevels: {} }, { marketContext: { ...context, reputation: 3000, routeSales: {} } }]) {
      const blocked = quoteKqMarketRoutes({ juryScore: 10, harvestGrams: 120, equipmentCodes, equipmentLevels, marketContext: { ...context, reputation: 3000 }, ...overrides }).find((q) => q.route === "rosin-signature")!;
      expect(blocked.market!.offers.every((offer) => !offer.accepted)).toBe(true);
    }
    expect(quotes(3000, 0).find((q) => q.route === "biomass")!.market!.offers).toEqual(quotes(0, 0).find((q) => q.route === "biomass")!.market!.offers);
  });

  it("prevents rushing the premium guarantee even with perfect lots, all routes open and optimal milestone bonuses", () => {
    const maxBase = Math.max(...KQ_MARKET_ROUTES.map(route => calculateKqMarketReputation(route.code, 10)));
    // Upper bound: allow every sale the best base gain and distribute sales optimally
    // across every transformation to maximize one-time bonuses. Real play is slower.
    let bonuses = Array<number>(81).fill(0);
    for (const route of KQ_MARKET_ROUTES.filter(route => route.family === "hash" || route.family === "rosin")) {
      const next = Array<number>(81).fill(0);
      for (let sales = 0; sales <= 80; sales++) {
        let routeBonus = 0;
        for (let count = 0; count <= sales; count++) {
          routeBonus += getKqRouteExpertiseBonusReputation(route.code, count, 1);
          next[sales] = Math.max(next[sales], bonuses[sales - count] + routeBonus);
        }
      }
      bonuses = next;
    }
    expect(maxBase).toBe(37);
    const premiumThreshold = KQ_MARKET_REPUTATION_TIERS.find(tier => tier.guaranteedPolicy === "premium")!.minimum;
    for (let sales = 0; sales <= 35; sales++) expect(sales * maxBase + bonuses[sales]).toBeLessThan(premiumThreshold);
    expect(70 * maxBase + bonuses[70]).toBeLessThan(KQ_MARKET_REPUTATION_TIERS.at(-1)!.minimum);
  });

  it("increases prices monotonically through every tier for flowers and transformations", () => {
    for (let window = 0; window < 6; window++) {
      const previous = new Map<KqMarketRouteCode, number>();
      for (const tier of KQ_MARKET_REPUTATION_TIERS) {
        for (const quote of quotes(tier.minimum, 9, { window, recentSales: { raw: 10, "dry-sift": 10 } })) {
          expect(quote.payoutCents).toBeGreaterThanOrEqual(previous.get(quote.route) ?? 0);
          previous.set(quote.route, quote.payoutCents);
        }
      }
    }
  });
});
