import { describe, expect, it } from "vitest";
import { classifyContestProductTrack, type ContestProductPricing } from "@/lib/contest-product-track";

const flower = (overrides: Partial<ContestProductPricing> = {}): ContestProductPricing => ({
  category: "fleurs", price: 25, weightGrams: 10, ...overrides,
});

describe("classifyContestProductTrack", () => {
  it.each([
    { price: 25, weightGrams: 10, cents: 250, status: "eligible", track: "regular" },
    { price: 2.5, weightGrams: 1, cents: 250, status: "eligible", track: "regular" },
    { price: 50, weightGrams: 20, cents: 250, status: "eligible", track: "regular" },
    { price: 35, weightGrams: 10, cents: 350, status: "eligible", track: "concours" },
    { price: 10, weightGrams: 10, cents: 100, status: "ineligible", track: null },
    { price: 24.94, weightGrams: 10, cents: 249, status: "ineligible", track: null },
    { price: 24.95, weightGrams: 10, cents: 250, status: "eligible", track: "regular" },
    { price: 25.04, weightGrams: 10, cents: 250, status: "eligible", track: "regular" },
    { price: 25.05, weightGrams: 10, cents: 251, status: "eligible", track: "concours" },
  ])("classifies €$price for $weightGrams g after cent rounding", ({ price, weightGrams, cents, status, track }) => {
    expect(classifyContestProductTrack(flower({ price, weightGrams }))).toEqual({
      status, track, pricePerGramCents: cents,
    });
  });

  it("keeps a Regular flower eligible during a promotion below €2.50/g", () => {
    expect(classifyContestProductTrack(flower({ price: 20, originalPrice: 25, promoPercent: 20 }))).toEqual({
      status: "eligible", track: "regular", pricePerGramCents: 250,
    });
  });

  it("keeps a Concours flower in Concours when its sale price reaches €2.50/g", () => {
    expect(classifyContestProductTrack(flower({ originalPrice: 50, promoPercent: 50 }))).toEqual({
      status: "eligible", track: "concours", pricePerGramCents: 500,
    });
  });

  it.each([undefined, 0, -10, 100, 150, NaN, Infinity])("uses the higher reference price independently of promotion metadata: %s", promoPercent => {
    expect(classifyContestProductTrack(flower({ originalPrice: 50, promoPercent }))).toEqual({
      status: "eligible", track: "concours", pricePerGramCents: 500,
    });
  });

  it.each([undefined, 0, -1, 20, 25, NaN, Infinity])("ignores an invalid or non-discounted original price: %s", originalPrice => {
    expect(classifyContestProductTrack(flower({ originalPrice, promoPercent: 20 }))).toEqual({
      status: "eligible", track: "regular", pricePerGramCents: 250,
    });
  });

  it.each(["price", "weightGrams"] as const)("leaves missing, zero, negative or non-finite %s unresolved", field => {
    for (const value of [undefined, 0, -1, NaN, Infinity, -Infinity]) {
      expect(classifyContestProductTrack(flower({ [field]: value }))).toEqual({
        status: "unknown", track: null, pricePerGramCents: null,
      });
    }
  });

  it("does not rescue an invalid current price using a promotion reference", () => {
    expect(classifyContestProductTrack(flower({ price: 0, originalPrice: 25, promoPercent: 20 }))).toEqual({
      status: "unknown", track: null, pricePerGramCents: null,
    });
  });

  it("leaves ambiguous variant pricing unresolved even when the base price appears eligible", () => {
    expect(classifyContestProductTrack(flower({ variantOptions: [{ label: "10 g", price: 25 }, { label: "20 g", price: 40 }] }))).toEqual({
      status: "unknown", track: null, pricePerGramCents: null,
    });
    expect(classifyContestProductTrack(flower({ variantOptions: [] }))).toEqual({
      status: "eligible", track: "regular", pricePerGramCents: 250,
    });
  });

  it.each([
    { category: "huiles" }, { category: undefined }, { isPack: true },
    { category: "accessoires", price: undefined, weightGrams: undefined },
  ])("excludes non-flowers and packs before considering ambiguous pricing: %j", overrides => {
    expect(classifyContestProductTrack(flower(overrides))).toEqual({
      status: "ineligible", track: null, pricePerGramCents: null,
    });
  });

  it("leaves unrepresentable price-per-gram calculations unresolved", () => {
    expect(classifyContestProductTrack(flower({ price: Number.MAX_VALUE, weightGrams: Number.MIN_VALUE }))).toEqual({
      status: "unknown", track: null, pricePerGramCents: null,
    });
  });
});
