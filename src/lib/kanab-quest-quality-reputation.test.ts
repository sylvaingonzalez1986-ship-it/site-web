import { describe, expect, it } from "vitest";
import {
  calculateKqMarketReputation, formatKqReputationDelta, previewKqMarketReputation,
  getKqRouteExpertiseBonusReputation, quoteKqMarketRoutes, getKqMarketRecommendations,
} from "@/lib/kanab-quest-market";

describe("quality-based market reputation", () => {
  it.each([
    ["dry-sift", 6.2, -4], ["dry-sift", 6.9, -1],
    ["dry-sift", 7, 0], ["dry-sift", 7.9, 0], ["dry-sift", 8, 5],
    ["ice-water-hash", 6.8, -1], ["ice-water-hash", 7.5, 0], ["ice-water-hash", 9, 14],
    ["rosin-trial", 7.5, -3], ["rosin-selection", 7.5, -4],
    ["rosin-selection", 7.9, -1], ["rosin-premium", 8, 0],
    ["rosin-premium", 8.7, 0], ["rosin-premium", 8.8, 10],
    ["rosin-signature", 9, 17], ["static-sift", 8.3, 0],
    ["static-sift", 8.8, 15], ["hash-signature", 8.8, 17],
    ["raw", 6.5, -2], ["raw", 7.5, 0], ["raw", 8, 4],
    ["biomass", 2, 0], ["biomass", 10, 0],
  ] as const)("grades %s at %s/10 as %s reputation", (route, score, delta) => {
    expect(calculateKqMarketReputation(route, score)).toBe(delta);
  });

  it("makes average flowers neutral as hash but penalized as rosin", () => {
    const quotes = quoteKqMarketRoutes({ juryScore: 7.5, harvestGrams: 100, equipmentCodes: ["SIFT-TRAY", "PRESS-20T"] });
    expect(quotes.find((quote) => quote.route === "dry-sift")).toMatchObject({ available: true, reputationGain: 0 });
    expect(quotes.find((quote) => quote.route === "rosin-selection")).toMatchObject({ available: true, reputationGain: -4 });
    expect(getKqMarketRecommendations(quotes).bestReputation).toBeNull();
  });

  it("never rewards a neutral or poor milestone sale", () => {
    for (const count of [3, 6, 10]) {
      expect(getKqRouteExpertiseBonusReputation("rosin-selection", count, -4)).toBe(0);
      expect(getKqRouteExpertiseBonusReputation("dry-sift", count, 0)).toBe(0);
      expect(getKqRouteExpertiseBonusReputation("dry-sift", count, 5)).toBeGreaterThan(0);
    }
  });

  it("caps applied losses at zero and never offsets them with a bonus", () => {
    expect(previewKqMarketReputation(100, -4, 25)).toEqual({ reputationAfter: 96, reputationGain: -4 });
    expect(previewKqMarketReputation(2, -4, 0)).toEqual({ reputationAfter: 0, reputationGain: -2 });
    expect(previewKqMarketReputation(0, -4, 0)).toEqual({ reputationAfter: 0, reputationGain: 0 });
    expect(previewKqMarketReputation(10, 0, 25)).toEqual({ reputationAfter: 10, reputationGain: 0 });
    expect(previewKqMarketReputation(10, 5, 5)).toEqual({ reputationAfter: 20, reputationGain: 10 });
    expect([-4, 0, 5].map(formatKqReputationDelta)).toEqual(["-4", "0", "+5"]);
  });
});
