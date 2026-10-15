import { describe, expect, it } from "vitest";
import { createKqBusinessPreview } from "./kanab-quest-business";
import { createKqCustomerDemandSnapshot } from "./kanab-quest-customer-demand";
import type { KqCommerceSnapshot } from "./kanab-quest-commerce";
import { createKqOnlinePreview, estimateKqOnlineOffer } from "./kanab-quest-online";
import { createKqMarketingResults, getKqMarketingFit, getKqMarketingPreview, KQ_MARKETING_BUDGETS, KQ_MARKETING_CAMPAIGNS, type KqMarketingCampaignActive } from "./kanab-quest-marketing";

const NOW = Date.parse("2026-10-15T12:00:00Z"), HOUR = 3_600_000;
function state(): KqCommerceSnapshot {
  const online = createKqOnlinePreview(NOW);
  online.listings = [{ id: "listing", stockId: "stock", name: "Récolte", route: "raw", formatGrams: 5,
    packagingCode: "kraft-5", packetPriceCents: 3500, initialPackets: 30, remainingPackets: 30, soldPackets: 0,
    status: "active", qualityScore: 8, baseUnitCents: 180, createdAt: new Date(NOW).toISOString() }];
  const business = createKqBusinessPreview(NOW);
  business.shop = { ...business.shop, name: "Atelier", createdAt: online.site.createdAt, active: true, tier: "basic" };
  return { online, business, cashCents: 100000, reputation: 0, clients: 0, revision: 0, computerOwned: true, internetRenew: false,
    campaign: null, stocks: [], receipts: [], rawLots: [], electricityOutstandingCents: 0, marketVolumes: {}, ownVolumes: {}, routeSales: {} };
}
function campaign(): KqMarketingCampaignActive {
  return { version: 2, id: "campaign", code: "behind-scenes", angle: "value", listingId: "listing", listingName: "Récolte", budgetCode: "local",
    costCents: 3000, visitorsPerDay: 56.25, followersPerOrder: 10, goalOrders: 3, followersCap: 30,
    startedAt: new Date(NOW - 12 * HOUR).toISOString(), launchesAt: new Date(NOW).toISOString(), endsAt: new Date(NOW + 48 * HOUR).toISOString(), results: createKqMarketingResults() };
}
function offer(data: KqCommerceSnapshot, listingId = "listing", advertisingMultiplier = 1) {
  const row = data.online!.listings[0];
  return estimateKqOnlineOffer({ ...row, quality: row.qualityScore, listingId, online: data.online!, reputation: data.reputation, clients: data.clients, advertisingMultiplier });
}

describe("Prepared marketing campaigns", () => {
  it("uses bounded budgets and distinct preparation, traffic and follower objectives", () => {
    expect(KQ_MARKETING_BUDGETS.map(item => [item.costCents, item.visitorsPerDay])).toEqual([[3000, 75], [8000, 160], [18000, 280]]);
    expect(KQ_MARKETING_CAMPAIGNS.map(item => item.preparationHours)).toEqual([0, 4, 12, 4]);
    for (const definition of KQ_MARKETING_CAMPAIGNS) expect(definition.goalOrders * definition.followersPerOrder).toBe(definition.followersCap);
  });

  it("starts traffic only at launch and targets exactly one listing without stacking paid advertising", () => {
    const data = state();
    const organic = offer(data);
    data.online!.marketing.active = campaign();
    const targeted = offer(data);
    expect(targeted.ordersPerDay).toBeGreaterThan(organic.ordersPerDay);
    expect(offer(data, "other").ordersPerDay).toBeCloseTo(organic.ordersPerDay, 8);
    expect(offer(data, "listing", 2).ordersPerDay - offer(data, "other", 2).ordersPerDay).toBeCloseTo(targeted.ordersPerDay - organic.ordersPerDay, 8);
    data.online!.serverNow = new Date(NOW - 1).toISOString();
    expect(offer(data).ordersPerDay).toBeCloseTo(organic.ordersPerDay, 8);
    data.online!.serverNow = data.online!.marketing.active.endsAt;
    expect(offer(data).ordersPerDay).toBeCloseTo(organic.ordersPerDay, 8);
  });

  it("does not divide targeted traffic between unrelated listings or manufacture another audience", () => {
    const data = state();
    const organic = offer(data).ordersPerDay;
    data.online!.marketing.active = campaign();
    const campaignExtra = offer(data).ordersPerDay - organic;
    data.online!.listings.push({ ...data.online!.listings[0], id: "other" });
    expect(offer(data).ordersPerDay).toBeCloseTo(organic / 2 + campaignExtra, 8);
    expect(offer(data, "other").ordersPerDay).toBeCloseTo(organic / 2, 8);
  });

  it("makes bad audience alignment materially more expensive without guaranteed buyers", () => {
    expect(getKqMarketingFit("value", 8, 1.05)).toBe(1.15);
    expect(getKqMarketingFit("value", 8, 1.06)).toBe(.35);
    expect(getKqMarketingFit("craft", 7.4, 1)).toBe(.45);
    expect(getKqMarketingFit("premium", 8.5, 1.5)).toBe(1.15);
    expect(getKqMarketingFit("premium", 8.49, 1.5)).toBe(.3);
    const data = state();
    data.online!.marketing.active = campaign();
    data.online!.listings[0].packetPriceCents = 1_000_000;
    expect(offer(data).ordersPerDay).toBe(0);
    const preview = getKqMarketingPreview({ data, code: "behind-scenes", angle: "premium", listingId: "listing", budgetCode: "national" });
    expect(preview.projectedExtraContributionCents).toBe(0);
    expect(preview.expectedFollowers).toBe(0);
    expect(preview.netAfterCampaignCents).toBe(-18000);
  });

  it("previews incremental contribution after the campaign bill without changing state", () => {
    const data = state(), before = structuredClone(data);
    const preview = getKqMarketingPreview({ data, code: "behind-scenes", angle: "craft", listingId: "listing", budgetCode: "regional" });
    expect(preview.ready).toBe(true);
    expect(preview.costCents).toBe(8000);
    expect(preview.projectedExtraOrders).toBeGreaterThan(0);
    expect(preview.projectedOrders).toBeLessThanOrEqual(30);
    expect(preview.netAfterCampaignCents).toBe(preview.projectedExtraContributionCents - 8000);
    expect(preview.breakEvenOrders).toBe(Math.ceil(8000 / preview.contributionPerPacketCents));
    expect(data).toEqual(before);
    const intro = getKqMarketingPreview({ data, code: "introduction", angle: "value", listingId: "listing", budgetCode: "national" });
    expect(intro).toMatchObject({ costCents: 0, visitorsPerDay: 35, budget: { code: "local" } });
  });

  it("does not sell through preparation, stock, quality or unpaid hosting in its campaign estimate", () => {
    const data = state();
    data.online!.listings[0].qualityScore = 5.8;
    expect(getKqMarketingPreview({ data, code: "behind-scenes", angle: "value", listingId: "listing", budgetCode: "national" }).projectedOrders).toBe(0);
    data.online!.listings[0].qualityScore = 8;
    data.online!.site = { ...data.online!.site, tier: "improved", paidUntil: new Date(NOW + 6 * HOUR).toISOString(), renew: true };
    const expiry = getKqMarketingPreview({ data, code: "behind-scenes", angle: "value", listingId: "listing", budgetCode: "national" });
    expect(expiry.projectedOrders).toBe(0);
    expect(expiry.warnings.some(warning => warning.includes("hébergement"))).toBe(true);
    data.online!.site.tier = "basic";
    data.online!.listings[0].remainingPackets = 1;
    const limited = getKqMarketingPreview({ data, code: "behind-scenes", angle: "value", listingId: "listing", budgetCode: "national" });
    expect(limited.projectedOrders).toBeLessThanOrEqual(1);
    expect(limited.expectedFollowers).toBeLessThanOrEqual(10);
    expect(limited.warnings.some(warning => warning.includes("budget plus faible"))).toBe(true);
  });

  it("blocks missing launch prerequisites and feature-gates legacy servers", () => {
    const data = state();
    data.online!.marketing.version = undefined;
    data.online!.site.active = false;
    data.cashCents = 0;
    data.online!.listings[0].status = "paused";
    const preview = getKqMarketingPreview({ data, code: "feedback", angle: "value", listingId: "listing", budgetCode: "national" });
    expect(preview.ready).toBe(false);
    expect(preview.blockingReasons).toHaveLength(5);
  });

  it("shows an exact cooldown deadline and accepts a fully packed active harvest", () => {
    const data = state();
    const input = { data, code: "harvest" as const, angle: "value" as const, listingId: "listing", budgetCode: "local" as const };
    expect(getKqMarketingPreview(input).ready).toBe(true);
    data.online!.marketing.cooldowns.harvest = "2026-10-18T12:00:00Z";
    const preview = getKqMarketingPreview(input);
    expect(preview.ready).toBe(false);
    expect(preview.blockingReasons[0]).toContain("18 octobre 2026");
    expect(preview.blockingReasons[0]).toContain("14:00");
  });

  it("consumes a one-packet market premium separately in each forecast without multiplying followers", () => {
    const data = state();
    data.customerDemand = createKqCustomerDemandSnapshot(NOW);
    data.customerDemand.endsAt = new Date(NOW + 72 * HOUR).toISOString();
    const request = data.customerDemand.requests.find(request => request.channel === "online")!;
    request.remainingUnits = 50;
    request.bonusPercent = 25;
    const row = data.online!.listings[0];
    row.varietyCode = request.varietyCode;
    row.qualityScore = 8.2;
    row.packetPriceCents = 4375;
    const before = structuredClone(data);
    const input = { data, code: "introduction" as const, angle: "craft" as const, listingId: "listing", budgetCode: "local" as const };
    data.online!.followers = 5000;
    const limited = getKqMarketingPreview(input);
    expect(limited.projectedOrders).toBeGreaterThan(1);
    expect(limited.expectedFollowers).toBeLessThanOrEqual(5);
    request.remainingUnits = 1500;
    const abundant = getKqMarketingPreview(input);
    expect(abundant.expectedFollowers).toBeGreaterThan(limited.expectedFollowers);
    expect(abundant.projectedOrders).toBeGreaterThan(limited.projectedOrders);
    expect(before.customerDemand!.requests.find(request => request.channel === "online")!.remainingUnits).toBe(50);
    expect(request.remainingUnits).toBe(1500);
  });

  it("checks audience fit at diffusion after quality has aged during preparation", () => {
    const data = state();
    data.online!.listings[0].qualityScore = 7.51;
    const preview = getKqMarketingPreview({ data, code: "behind-scenes", angle: "craft", listingId: "listing", budgetCode: "local" });
    expect(preview.fit).toBe(.45);
    data.online!.listings.push({ ...data.online!.listings[0], id: "expired", qualityScore: 5.7 });
    expect(offer(data).ordersPerDay).toBeCloseTo(estimateKqOnlineOffer({ ...data.online!.listings[0], quality: 7.51, online: data.online!, reputation: 0, clients: 0, activeListingCount: 1 }).ordersPerDay, 8);
  });
});
