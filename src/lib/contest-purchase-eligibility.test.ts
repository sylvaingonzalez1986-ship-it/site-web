import { describe, expect, it } from "vitest";

import {
  getContestPurchasedProductBaseId,
  isContestEligiblePaymentState,
  isContestPurchasedProductIdMatch,
  normalizeContestPublicLimit,
} from "@/lib/supabase/contest-backend";

describe("contest purchase eligibility", () => {
  it("accepts payment states treated as paid orders elsewhere", () => {
    expect(isContestEligiblePaymentState("paid")).toBe(true);
    expect(isContestEligiblePaymentState("not_configured")).toBe(false);
    expect(isContestEligiblePaymentState("pending")).toBe(false);
    expect(isContestEligiblePaymentState("failed")).toBe(false);
  });

  it("matches contest products bought through a variant", () => {
    expect(isContestPurchasedProductIdMatch("amnesia-haze", "amnesia-haze")).toBe(true);
    expect(isContestPurchasedProductIdMatch("amnesia-haze::5g", "amnesia-haze")).toBe(true);
    expect(isContestPurchasedProductIdMatch("amnesia-haze::10g", "amnesia-haze")).toBe(true);
    expect(isContestPurchasedProductIdMatch("super-skunk::5g", "amnesia-haze")).toBe(false);
  });

  it("normalizes cart variant ids back to the base product id", () => {
    expect(getContestPurchasedProductBaseId("amnesia-haze::10g")).toBe("amnesia-haze");
    expect(getContestPurchasedProductBaseId(" amnesia-haze ::10g ")).toBe("amnesia-haze");
    expect(getContestPurchasedProductBaseId("")).toBe("");
  });

  it("normalizes public list limits defensively", () => {
    expect(normalizeContestPublicLimit(undefined, 12, 30)).toBe(12);
    expect(normalizeContestPublicLimit(Number.NaN, 12, 30)).toBe(12);
    expect(normalizeContestPublicLimit("abc", 12, 30)).toBe(12);
    expect(normalizeContestPublicLimit(0, 12, 30)).toBe(1);
    expect(normalizeContestPublicLimit(-5, 12, 30)).toBe(1);
    expect(normalizeContestPublicLimit(200, 12, 30)).toBe(30);
    expect(normalizeContestPublicLimit(12.9, 12, 30)).toBe(12);
  });
});
