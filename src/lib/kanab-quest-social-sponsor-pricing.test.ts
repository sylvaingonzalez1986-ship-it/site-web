import { describe, expect, it } from "vitest";
import { KQ_SOCIAL_SPONSORS } from "./kanab-quest-social-stories";
import { getKqSocialSponsorPricing, isKqSocialSponsorPricing, KQ_SOCIAL_MAX_SPONSOR_REWARD_CENTS } from "./kanab-quest-social-sponsor-pricing";

describe("fictional campaign pricing", () => {
  it("prices each company's audience with diminishing growth and a real budget ceiling", () => {
    for (const sponsor of KQ_SOCIAL_SPONSORS) {
      const at = (followers: number, haters = 0, trust = 80) => getKqSocialSponsorPricing(sponsor, { followers, haters, trust });
      expect(at(sponsor.minimumFollowers).rewardCents).toBe(sponsor.rewardCents);
      expect(at(sponsor.minimumFollowers * 2).rewardCents).toBeGreaterThan(at(sponsor.minimumFollowers).rewardCents);
      expect(at(50_000).rewardCents).toBeLessThanOrEqual(sponsor.maxRewardCents!);
      expect(at(50_000).rewardCents).toBeLessThanOrEqual(KQ_SOCIAL_MAX_SPONSOR_REWARD_CENTS);
      expect(at(50_000, 50).rewardCents).toBeLessThan(at(50_000).rewardCents);
      expect(at(50_000, 100).rewardCents).toBeLessThan(at(50_000, 50).rewardCents);
      // Trust is an access requirement, not a hidden second fee multiplier.
      expect(at(1000, 20, 90).rewardCents).toBe(at(1000, 20, 50).rewardCents);
    }
  });

  it("shows an exact, positive fee decomposition and preserves pressure deductions at the cap", () => {
    for (const sponsor of KQ_SOCIAL_SPONSORS) for (const followers of [0, 75, 1000, 5000, 50_000]) for (const haters of [0, 25, 50, 75, 100]) {
      const quote = getKqSocialSponsorPricing(sponsor, { followers, haters, trust: 75 });
      expect(quote.baseCents + quote.audienceBonusCents - quote.hatersPenaltyCents - quote.roundingCents).toBe(quote.rewardCents);
      expect(quote.rewardCents).toBeGreaterThan(0);
      expect(quote.rewardCents % 500).toBe(0);
      expect(quote.roundingCents).toBeGreaterThanOrEqual(0);
      expect(quote.roundingCents).toBeLessThan(500);
      expect(isKqSocialSponsorPricing(quote, sponsor)).toBe(true);
      expect(isKqSocialSponsorPricing({ ...quote, rewardCents: quote.rewardCents + 1 }, sponsor)).toBe(false);
    }
  });

  it("rejects forged signing figures, unknown versions and extra price fields", () => {
    const sponsor = KQ_SOCIAL_SPONSORS[0];
    const quote = getKqSocialSponsorPricing(sponsor, { followers: 1000, haters: 20, trust: 75 });
    for (const patch of [{ version: 2 }, { followers: -1 }, { followers: 50_001 }, { followers: 50.5 }, { haters: 101 }, { trust: "75" }, { roundingCents: -1 }, { extra: 1 }]) {
      expect(isKqSocialSponsorPricing({ ...quote, ...patch }, sponsor)).toBe(false);
    }
  });
});
