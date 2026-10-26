import { describe, expect, it } from "vitest";
import { applyKqSocialCommand, createKqSocialSnapshot, getKqSponsorOffers, isKqSocialSnapshot, normalizeKqSocialSnapshot, parseKqSocialCommand, refreshKqSocialSnapshot } from "./kanab-quest-social";
import { KQ_SOCIAL_LEGACY_SPONSORS, KQ_SOCIAL_SPONSORS } from "./kanab-quest-social-stories";
import { KQ_SOCIAL_MAX_SPONSOR_REWARD_CENTS } from "./kanab-quest-social-sponsor-pricing";
import type { KqSocialSnapshot, KqSocialSponsorDefinition } from "./kanab-quest-social-types";

const now = Date.parse("2026-10-25T12:00:00Z");
const base = (state: KqSocialSnapshot) => ({ modelVersion: 2 as const, requestKey: `97000000-0000-4000-8000-${String(state.revision + 1).padStart(12, "0")}`, expectedRevision: state.revision });
function ready() {
  const state = createKqSocialSnapshot(now, 10_000);
  for (const account of Object.values(state.platforms)) Object.assign(account, { followers: 5000, trust: 90 });
  state.socialFollowers = 10_000;
  return state;
}
function sign(state = ready(), sponsor = KQ_SOCIAL_SPONSORS[0]) {
  const quote = getKqSponsorOffers(state).find(offer => offer.sponsor.id === sponsor.id)!;
  return applyKqSocialCommand(state, { ...base(state), action: "sponsor-accept", sponsorId: sponsor.id, expectedRewardCents: quote.rewardCents! }, now);
}
function fulfill(state: KqSocialSnapshot, sponsor: KqSocialSponsorDefinition) {
  const first = applyKqSocialCommand(state, { ...base(state), action: "sponsor-post", tag: sponsor.requiredTags[0] }, now);
  return applyKqSocialCommand(first, { ...base(first), action: "sponsor-post", tag: sponsor.requiredTags[1] }, now + 86_400_000);
}

describe("signed social partnership fees", () => {
  it("quotes the relevant network and keeps trust as an eligibility requirement", () => {
    const state = ready(), sponsor = KQ_SOCIAL_SPONSORS[0], account = state.platforms[sponsor.platform];
    account.followers = sponsor.minimumFollowers;
    const first = getKqSponsorOffers(state).find(offer => offer.sponsor.id === sponsor.id)!;
    expect(first.rewardCents).toBe(sponsor.rewardCents);
    state.platforms[sponsor.platform === "x" ? "instagram" : "x"].followers = 50_000;
    expect(getKqSponsorOffers(state).find(offer => offer.sponsor.id === sponsor.id)?.rewardCents).toBe(first.rewardCents);
    account.followers = 50_000;
    const capped = getKqSponsorOffers(state).find(offer => offer.sponsor.id === sponsor.id)!;
    expect(capped.rewardCents).toBe(sponsor.maxRewardCents);
    expect(capped.rewardCents).toBeLessThanOrEqual(KQ_SOCIAL_MAX_SPONSOR_REWARD_CENTS);
    account.haters = 40;
    expect(getKqSponsorOffers(state).find(offer => offer.sponsor.id === sponsor.id)!.rewardCents!).toBeLessThan(capped.rewardCents!);
    account.trust = sponsor.minimumTrust - 1;
    expect(getKqSponsorOffers(state).find(offer => offer.sponsor.id === sponsor.id)).toMatchObject({ eligible: false, status: "locked" });
  });

  it("rejects absent or stale confirmation amounts, including pressure decay without a revision change", () => {
    const state = ready(), sponsor = KQ_SOCIAL_SPONSORS[0];
    state.platforms[sponsor.platform].haters = 40;
    const quote = getKqSponsorOffers(state).find(offer => offer.sponsor.id === sponsor.id)!;
    const command = { ...base(state), action: "sponsor-accept" as const, sponsorId: sponsor.id };
    const before = structuredClone(state);
    expect(() => applyKqSocialCommand(state, command, now)).toThrow(/montant/);
    expect(() => applyKqSocialCommand(state, { ...command, expectedRewardCents: quote.rewardCents! + 500 }, now)).toThrow(/montant/);
    const later = refreshKqSocialSnapshot(state, now + 2 * 3_600_000);
    expect(later.revision).toBe(state.revision);
    expect(getKqSponsorOffers(later).find(offer => offer.sponsor.id === sponsor.id)?.rewardCents).not.toBe(quote.rewardCents);
    expect(() => applyKqSocialCommand(state, { ...command, expectedRewardCents: quote.rewardCents! }, now + 2 * 3_600_000)).toThrow(/montant/);
    expect(state).toEqual(before);
    for (const invalid of [{ expectedRewardCents: -1 }, { expectedRewardCents: 0.1 }, { expectedRewardCents: KQ_SOCIAL_MAX_SPONSOR_REWARD_CENTS + 1 }, { rewardCents: quote.rewardCents }, { pricing: quote.pricing }]) {
      expect(parseKqSocialCommand({ ...command, ...invalid })).toBeNull();
    }
    expect(parseKqSocialCommand({ ...command, action: "sponsor-decline", expectedRewardCents: quote.rewardCents })).toBeNull();
  });

  it("freezes the signed price through changed audience, distrust and both sponsored publications", () => {
    const initial = ready(), sponsor = KQ_SOCIAL_SPONSORS[0];
    initial.platforms[sponsor.platform].haters = 40;
    const state = sign(initial), signed = structuredClone(state.sponsors.active!);
    Object.assign(state.platforms[sponsor.platform], { followers: 2000, trust: 5, haters: 95 });
    state.socialFollowers = 7000;
    const offer = getKqSponsorOffers(state).find(row => row.sponsor.id === sponsor.id)!;
    expect(offer).toMatchObject({ status: "active", rewardCents: signed.rewardCents, pricing: signed.pricing });
    expect(isKqSocialSnapshot(state)).toBe(true);
    const finished = fulfill(state, sponsor);
    expect(finished.sponsors.active).toMatchObject({ rewardCents: signed.rewardCents, pricing: signed.pricing });
    const paid = applyKqSocialCommand(finished, { ...base(finished), action: "sponsor-claim" }, now + 86_400_000);
    expect(paid.sponsors).toMatchObject({ earnedCents: signed.rewardCents, paidRewardsCents: { [sponsor.id]: signed.rewardCents }, active: null });
    expect(isKqSocialSnapshot(paid)).toBe(true);
    expect(() => applyKqSocialCommand(paid, { ...base(paid), action: "sponsor-claim" }, now + 86_400_000)).toThrow(/Aucun/);
    paid.history = [];
    expect(getKqSponsorOffers(paid).find(row => row.sponsor.id === sponsor.id)).toMatchObject({ status: "completed", rewardCents: signed.rewardCents });
    expect(getKqSponsorOffers(paid).find(row => row.sponsor.id === sponsor.id)).not.toHaveProperty("pricing");
  });

  it("rejects forged frozen amounts, quote details and paid-history mappings", () => {
    const signed = sign();
    const changedAmount = structuredClone(signed); changedAmount.sponsors.active!.rewardCents += 500;
    const changedBasis = structuredClone(signed); changedBasis.sponsors.active!.pricing!.baseCents += 500;
    const missingBasis = structuredClone(signed); delete missingBasis.sponsors.active!.pricing;
    for (const forged of [changedAmount, changedBasis, missingBasis]) expect(isKqSocialSnapshot(forged)).toBe(false);
    const sponsor = KQ_SOCIAL_SPONSORS[0], finished = fulfill(signed, sponsor);
    const paid = applyKqSocialCommand(finished, { ...base(finished), action: "sponsor-claim" }, now + 86_400_000);
    for (const map of [{ madeUp: 500 }, { [sponsor.id]: KQ_SOCIAL_MAX_SPONSOR_REWARD_CENTS + 500 }, { [sponsor.id]: 0 }, { [sponsor.id]: -1 }]) {
      expect(isKqSocialSnapshot({ ...paid, sponsors: { ...paid.sponsors, paidRewardsCents: map } })).toBe(false);
    }
  });

  it.each(KQ_SOCIAL_LEGACY_SPONSORS)("preserves the archived $id contract without adding new money fields", sponsor => {
    const initial = ready();
    expect(getKqSponsorOffers(initial).some(offer => offer.sponsor.id === sponsor.id)).toBe(false);
    const state = applyKqSocialCommand(initial, { ...base(initial), action: "sponsor-accept", sponsorId: sponsor.id }, now);
    expect(state.sponsors.active).not.toHaveProperty("pricing");
    expect(state.sponsors.active?.rewardCents).toBe(sponsor.rewardCents);
    expect(isKqSocialSnapshot(state)).toBe(true);
    expect(normalizeKqSocialSnapshot(JSON.parse(JSON.stringify(state)), now)).toEqual(state);
    const finished = fulfill(state, sponsor);
    const paid = applyKqSocialCommand(finished, { ...base(finished), action: "sponsor-claim" }, now + 86_400_000);
    expect(paid.sponsors.earnedCents).toBe(sponsor.rewardCents);
    expect(paid.sponsors).not.toHaveProperty("paidRewardsCents");
    expect(paid.history[0].outcome).toBe(sponsor.completionText);
    expect(getKqSponsorOffers(paid).find(offer => offer.sponsor.id === sponsor.id)?.rewardCents).toBe(sponsor.rewardCents);
    paid.history = [];
    expect(getKqSponsorOffers(paid).find(offer => offer.sponsor.id === sponsor.id)?.rewardCents).toBeNull();
    expect(isKqSocialSnapshot(paid)).toBe(true);
  });
});
