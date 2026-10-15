import { describe, expect, it } from "vitest";
import { createKqBusinessPreview } from "./kanab-quest-business";
import type { KqCommerceSnapshot } from "./kanab-quest-commerce";
import { createKqCustomerDemandSnapshot } from "./kanab-quest-customer-demand";
import { createKqOnlinePreview, type KqOnlineListing } from "./kanab-quest-online";
import { getKqShopDashboard, getKqShopStrategyPlans } from "./kanab-quest-shop-strategy";

const NOW = Date.parse("2026-10-15T12:00:00Z");
const HOUR = 3_600_000;
function state(listings: Partial<KqOnlineListing>[] = [{}]): KqCommerceSnapshot {
  const online = createKqOnlinePreview(NOW);
  online.listings = listings.map((listing, index) => ({
    id: `listing-${index}`, stockId: `stock-${index}`, name: "Récolte", route: "raw", formatGrams: 5,
    packagingCode: "kraft-5", packetPriceCents: 3500, initialPackets: 30, remainingPackets: 30, soldPackets: 0,
    status: "active", qualityScore: 8, baseUnitCents: 180, createdAt: new Date(NOW).toISOString(), ...listing,
  }));
  const business = createKqBusinessPreview(NOW);
  business.shop = { ...business.shop, name: "Atelier", createdAt: online.site.createdAt, active: true, tier: "basic" };
  return { online, business, cashCents: 100000, reputation: 0, clients: 0, revision: 0, computerOwned: true, internetRenew: false,
    campaign: null, stocks: [], receipts: [], rawLots: [], electricityOutstandingCents: 0, marketVolumes: {}, ownVolumes: {}, routeSales: {} };
}

describe("Shop strategy decisions", () => {
  it("uses retail references for flowers and exposes the price / cadence / satisfaction tradeoff", () => {
    const data = state();
    const before = structuredClone(data);
    const [rotation, balance, selection] = getKqShopStrategyPlans(data, "listing-0");
    expect([rotation.packetPriceCents, balance.packetPriceCents, selection.packetPriceCents]).toEqual([3150, 3675, 4375]);
    expect(rotation.ordersPerDay).toBeGreaterThan(balance.ordersPerDay);
    expect(balance.ordersPerDay).toBeGreaterThan(selection.ordersPerDay);
    expect(rotation.satisfactionScore).toBeGreaterThan(selection.satisfactionScore);
    expect(selection.contributionPerPacketCents).toBeGreaterThan(rotation.contributionPerPacketCents);
    expect(selection.projectedPackets).toBeLessThan(rotation.projectedPackets);
    expect(data).toEqual(before);
  });

  it("never forecasts more stock than exists and identifies a price already applied", () => {
    const data = state([{ remainingPackets: 1, packetPriceCents: 3150 }]);
    data.online!.followers = 5000;
    for (const plan of getKqShopStrategyPlans(data, "listing-0")) {
      expect(plan.projectedPackets).toBeCloseTo(1, 8);
      expect(plan.remainingPackets).toBeCloseTo(0, 8);
      expect(plan.projectedContributionCents).toBe(plan.contributionPerPacketCents);
      expect(plan.atRiskPackets).toBe(0);
    }
    expect(getKqShopStrategyPlans(data, "listing-0")[0].current).toBe(true);
  });

  it("shares the audience only between eligible active listings", () => {
    const single = getKqShopDashboard(state());
    const split = getKqShopDashboard(state([{}, {}]));
    expect(split.ordersPerDay).toBeCloseTo(single.ordersPerDay, 8);
    const withInactive = state([{}, { status: "paused" }, { qualityScore: 5.79 }, { remainingPackets: 0 }, { status: "closed" }]);
    expect(getKqShopDashboard(withInactive).ordersPerDay).toBeCloseTo(single.ordersPerDay, 8);
    expect(getKqShopDashboard(withInactive).activeListings).toBe(1);
    expect(getKqShopStrategyPlans(withInactive, "listing-1")).toEqual([]);
    expect(getKqShopStrategyPlans(withInactive, "listing-2")).toEqual([]);
    expect(getKqShopStrategyPlans(withInactive, "missing")).toEqual([]);
  });

  it("keeps a larger format from multiplying shared demand", () => {
    const five = getKqShopStrategyPlans(state(), "listing-0")[0];
    const ten = getKqShopStrategyPlans(state([{ formatGrams: 10, packagingCode: "kraft-10", packetPriceCents: 7000 }]), "listing-0")[0];
    expect(ten.ordersPerDay * 2).toBeCloseTo(five.ordersPerDay, 8);
    expect(ten.projectedPackets * 2).toBeCloseTo(five.projectedPackets, 8);
  });

  it("uses the remaining quality tick, without aging the snapshot twice", () => {
    const data = state([{ qualityScore: 5.8, createdAt: new Date(NOW - 3.5 * HOUR).toISOString() }]);
    const plan = getKqShopStrategyPlans(data, "listing-0")[0];
    expect(plan.projectedPackets).toBeCloseTo(plan.ordersPerDay * .5 / 24, 8);
    expect(plan.atRiskPackets).toBeCloseTo(30 - plan.projectedPackets, 8);
    expect(getKqShopDashboard(data).listings[0].saleableDays).toBeCloseTo(.5 / 24, 8);
    expect(getKqShopDashboard(data).bottleneck.code).toBe("quality");
    const glass = state([{ qualityScore: 5.81, packagingCode: "glass-5" }]);
    const kraft = state([{ qualityScore: 5.81 }]);
    expect(getKqShopStrategyPlans(glass, "listing-0")[0].projectedPackets).toBeGreaterThan(getKqShopStrategyPlans(kraft, "listing-0")[0].projectedPackets);
  });

  it("does not extend a campaign or a paid hosting period across seven days", () => {
    const data = state();
    data.online!.marketing.active = { id: "intro", code: "introduction", angle: "craft", startedAt: new Date(NOW).toISOString(), endsAt: new Date(NOW + HOUR).toISOString() };
    const campaign = getKqShopStrategyPlans(data, "listing-0")[0];
    expect(campaign.projectedPackets).toBeLessThan(campaign.ordersPerDay * 7);
    expect(campaign.projectedPackets).toBeGreaterThan(getKqShopStrategyPlans(state(), "listing-0")[0].projectedPackets);
    data.online!.site = { ...data.online!.site, tier: "improved", renew: true, paidUntil: new Date(NOW + .5 * HOUR).toISOString() };
    const paid = getKqShopStrategyPlans(data, "listing-0")[0];
    expect(paid.projectedPackets).toBeCloseTo(paid.ordersPerDay * .5 / 24, 8);
    data.online!.site.active = false;
    expect(getKqShopStrategyPlans(data, "listing-0").every(plan => plan.projectedPackets === 0 && plan.ordersPerDay === 0)).toBe(true);
    expect(getKqShopDashboard(data).visitorsPerDay).toBe(0);
    expect(getKqShopDashboard(data).bottleneck.code).toBe("suspended");
  });

  it("includes matching current demand without inventing future market requests", () => {
    const data = state();
    data.customerDemand = createKqCustomerDemandSnapshot(NOW);
    const request = data.customerDemand.requests.find(request => request.channel === "online")!;
    data.online!.listings[0].varietyCode = request.varietyCode;
    const plans = getKqShopStrategyPlans(data, "listing-0");
    expect(plans[0].packetPriceCents).toBe(Math.round(Math.round(3500 * (1 + request.bonusPercent / 100)) * .9));
    const before = structuredClone(data);
    expect(plans[0].projectedPackets).toBeLessThan(plans[0].ordersPerDay * 7);
    getKqShopStrategyPlans(data, "listing-0");
    expect(data).toEqual(before);
  });

  it("returns honest empty states instead of invented activity", () => {
    const empty = state([]);
    const dashboard = getKqShopDashboard(empty);
    expect(dashboard.ordersPerDay).toBe(0);
    expect(dashboard.contributionPerDayCents).toBe(0);
    expect(dashboard.stockDays).toBeNull();
    expect(dashboard.bottleneck.code).toBe("stock");
    empty.online = undefined;
    expect(getKqShopDashboard(empty).visitorsPerDay).toBe(0);
    expect(getKqShopStrategyPlans(empty, "listing-0")).toEqual([]);
  });
});
