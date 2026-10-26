import type { KqSocialAccount, KqSocialSponsorDefinition, KqSocialSponsorPricing } from "./kanab-quest-social-types";

/** Fictional campaign budgets, in cents; also enforced by the payment RPC. */
export const KQ_SOCIAL_MAX_SPONSOR_REWARD_CENTS = 600_000;
const quantumCents = 500;
const whole = (value: unknown, maximum: number): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= maximum;

/** The relevant network determines the fee. Trust gates eligibility separately. */
export function getKqSocialSponsorPricing(sponsor: KqSocialSponsorDefinition, stats: Pick<KqSocialAccount, "followers" | "haters" | "trust">): KqSocialSponsorPricing {
  if (sponsor.pricingVersion !== 1 || !whole(sponsor.maxRewardCents, KQ_SOCIAL_MAX_SPONSOR_REWARD_CENTS)
    || !whole(sponsor.rewardCents, sponsor.maxRewardCents) || sponsor.rewardCents < quantumCents * 2
    || !whole(sponsor.minimumFollowers, 50_000) || sponsor.minimumFollowers === 0
    || !whole(stats.followers, 50_000) || !whole(stats.haters, 100) || !whole(stats.trust, 100)) {
    throw new Error("Barème de partenariat invalide.");
  }
  const baseCents = sponsor.rewardCents;
  // A modest account keeps the base budget, conditional on meeting the brief.
  // Diminishing growth prevents a large audience from exhausting the economy.
  const audienceCents = Math.min(sponsor.maxRewardCents, Math.round(baseCents * Math.sqrt(Math.max(1, stats.followers / sponsor.minimumFollowers))));
  // Pressure remains a deduction even once the company's audience budget is capped.
  const hatersPenaltyCents = Math.round(audienceCents * stats.haters / 200);
  const beforeRounding = audienceCents - hatersPenaltyCents;
  const rewardCents = Math.floor(beforeRounding / quantumCents) * quantumCents;
  return { version: 1, followers: stats.followers, haters: stats.haters, trust: stats.trust,
    baseCents, audienceBonusCents: audienceCents - baseCents, hatersPenaltyCents,
    roundingCents: beforeRounding - rewardCents, rewardCents };
}

/** Recompute against the saved signing figures, never against today's account. */
export function isKqSocialSponsorPricing(value: unknown, sponsor: KqSocialSponsorDefinition): value is KqSocialSponsorPricing {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const saved = value as Record<string, unknown>;
  if (saved.version !== 1 || !whole(saved.followers, 50_000) || !whole(saved.haters, 100) || !whole(saved.trust, 100)) return false;
  try {
    const expected = getKqSocialSponsorPricing(sponsor, { followers: saved.followers, haters: saved.haters, trust: saved.trust });
    return Object.keys(saved).length === Object.keys(expected).length && Object.entries(expected).every(([key, amount]) => saved[key] === amount);
  } catch { return false; }
}
