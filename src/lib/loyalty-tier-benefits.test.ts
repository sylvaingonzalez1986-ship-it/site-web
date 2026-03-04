import { describe, expect, it } from "vitest";

import {
  getBadgeDiscountPercent,
  getBadgeExtraBoosterPacksPerOrder,
  getCanonicalBadgeBenefitsLines,
  hasBadgeDecemberGiftBenefit,
} from "@/lib/loyalty-tier-benefits";
import { defaultStore } from "@/data/default-store";

describe("loyalty-tier-benefits", () => {
  it("returns the configured discount for each badge tier", () => {
    expect(getBadgeDiscountPercent(defaultStore.content.profile, "decouverte")).toBe(1);
    expect(getBadgeDiscountPercent(defaultStore.content.profile, "explorateur")).toBe(4);
    expect(getBadgeDiscountPercent(defaultStore.content.profile, "connaisseur")).toBe(6);
    expect(getBadgeDiscountPercent(defaultStore.content.profile, "ambassadeur")).toBe(8);
    expect(getBadgeDiscountPercent(defaultStore.content.profile, "legende")).toBe(10);
  });

  it("returns the configured extra pack counts", () => {
    expect(getBadgeExtraBoosterPacksPerOrder("decouverte")).toBe(1);
    expect(getBadgeExtraBoosterPacksPerOrder("legende")).toBe(20);
  });

  it("includes advanced benefits only on the relevant top tiers", () => {
    expect(getCanonicalBadgeBenefitsLines("ambassadeur")).toContain("Acces aux ventes privees");
    expect(hasBadgeDecemberGiftBenefit("ambassadeur")).toBe(false);
    expect(hasBadgeDecemberGiftBenefit("legende")).toBe(true);
  });
});
