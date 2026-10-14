import { describe, expect, it } from "vitest";
import { KQ_BUDDIE_FLAVOR_PROFILES } from "./kanab-quest-buddie-flavors";
import { quoteKqCommerce, type KqCommerceState, type KqCommerceStock } from "./kanab-quest-commerce";
import { createKqOnlinePreview, estimateKqOnlineOffer } from "./kanab-quest-online";
import { createKqCustomerDemandSnapshot, getKqActiveCustomerDemand, getKqCustomerDemandFlavorMatch, getKqCustomerDemandPrice,
  KQ_CUSTOMER_DEMAND_PERIOD_MS as PERIOD, KQ_CUSTOMER_DEMAND_PREVIEW_MS as PREVIEW } from "./kanab-quest-customer-demand";

const now = Date.parse("2026-10-12T12:00:00Z");
const snapshot = () => {
  const demand = createKqCustomerDemandSnapshot(now);
  demand.requests = demand.requests.map(request => ({ ...request, varietyCode: "HH2026-005", flavorCodes: ["citron", "diesel"], bonusPercent: 20 }));
  return demand;
};
const stock: KqCommerceStock = { id: "stock", flowerId: "flower", name: "OG Kush", varietyCode: "HH2026-025", route: "raw", batchRoute: "raw", juryScore: 9,
  initialUnits: 6000, remainingUnits: 6000, equivalentUnits: 6000, originalUnits: 6000, baseUnitCents: 180,
  repExact: 0, repRounded: 0, professionalUnits: 0, counted: false };
function commerce(): KqCommerceState {
  return { online: createKqOnlinePreview(now), customerDemand: snapshot(), revision: 0, cashCents: 100000, reputation: 0, clients: 0,
    computerOwned: true, internetRenew: false, stocks: [stock], receipts: [], marketVolumes: {}, ownVolumes: {}, routeSales: {},
    campaign: { id: "campaign", revision: 0, reputation: 0, clientsStart: 0, internetPaid: true, event: "normal", directUsed: 0, shopUsed: 0, goodUnits: 0, disappointmentUnits: 0 } };
}
const forecast = (varietyCode: string, demand = snapshot(), quality = 9) => estimateKqOnlineOffer({ route: "raw", varietyCode, customerDemand: demand,
  quality, baseUnitCents: 180, formatGrams: 5, packagingCode: "kraft-5", packetPriceCents: 4000, reputation: 0, clients: 0, online: createKqOnlinePreview(now) });

describe("periodic aroma demand", () => {
  it("reveals the next profiles exactly 24 hours before a 72-hour boundary", () => {
    const end = Date.parse(snapshot().endsAt);
    expect(createKqCustomerDemandSnapshot(end - PREVIEW - 1).upcoming).toEqual([]);
    const preview = createKqCustomerDemandSnapshot(end - PREVIEW);
    expect(preview.upcoming).toHaveLength(3);
    expect(createKqCustomerDemandSnapshot(end).requests).toEqual(preview.upcoming);
    expect(Date.parse(preview.endsAt) - Date.parse(preview.startsAt)).toBe(PERIOD);
    for (let period = 0; period < 204; period++) {
      const demand = createKqCustomerDemandSnapshot(period * PERIOD);
      for (const request of demand.requests) {
        expect(new Set(request.flavorCodes).size).toBe(2);
        expect(Object.values(KQ_BUDDIE_FLAVOR_PROFILES).some(profile => profile.flavors.every(flavor => request.flavorCodes.includes(flavor)))).toBe(true);
      }
    }
  });

  it("rewards zero, one and two aromas independently of the reference variety", () => {
    const request = snapshot().requests[0];
    expect(getKqCustomerDemandFlavorMatch(request, "HH2026-007")).toEqual({ matchedFlavorCount: 0, bonusPercent: 0 });
    expect(getKqCustomerDemandFlavorMatch(request, "HH2026-013")).toEqual({ matchedFlavorCount: 1, bonusPercent: 10 });
    expect(getKqCustomerDemandFlavorMatch(request, "HH2026-025")).toEqual({ matchedFlavorCount: 2, bonusPercent: 20 });
    expect(getKqCustomerDemandFlavorMatch(request, "unknown").matchedFlavorCount).toBe(0);
    const reversed = { ...request, flavorCodes: ["diesel", "citron"] as const };
    expect(getKqCustomerDemandFlavorMatch(reversed, "HH2026-025").matchedFlavorCount).toBe(2);
  });

  it("does not grant a bonus before the period, after it, below quality, or after exhaustion", () => {
    const demand = snapshot();
    for (const time of [Date.parse(demand.startsAt) - 1, Date.parse(demand.endsAt)])
      expect(getKqActiveCustomerDemand(demand, "online", stock.varietyCode, 9, time)).toBeNull();
    expect(getKqActiveCustomerDemand(demand, "online", stock.varietyCode, 7.99, now)).toBeNull();
    demand.requests[0].remainingUnits = 0;
    expect(getKqActiveCustomerDemand(demand, "online", stock.varietyCode, 9, now)).toBeNull();
  });

  it.each(["cbd-shop", "wholesale"] as const)("keeps normal %s sales available with no matching aromas", channel => {
    const base = channel === "cbd-shop" ? 300 : 210;
    for (const [varietyCode, bonus, count] of [["HH2026-007", 0, 0], ["HH2026-013", 10, 1], ["HH2026-025", 20, 2]] as const) {
      const offer = quoteKqCommerce(commerce(), { ...stock, varietyCode }, channel, "advised", 100, now);
      expect(offer).toMatchObject({ units: 100, reason: null, unitCents: base + base * bonus / 100, payoutCents: base * (10 + bonus / 10) });
      expect(offer.customerDemand?.matchedFlavorCount ?? 0).toBe(count);
    }
  });

  it("pays only the remaining bonus volume, then accepts the rest at the normal price", () => {
    const state = commerce();
    state.customerDemand!.requests[1].remainingUnits = 10;
    const mixed = quoteKqCommerce(state, stock, "cbd-shop", "advised", 100, now);
    expect(mixed).toMatchObject({ units: 100, unitCents: 306, payoutCents: 3060, customerDemand: { units: 10, matchedFlavorCount: 2 } });
    state.customerDemand!.requests[1].remainingUnits = 0;
    expect(quoteKqCommerce(state, stock, "cbd-shop", "advised", 100, now)).toMatchObject({ units: 100, unitCents: 300, payoutCents: 3000, reason: null });
  });

  it("keeps an otherwise saleable lot available below the bonus quality threshold", () => {
    const offer = quoteKqCommerce(commerce(), { ...stock, juryScore: 7 }, "cbd-shop", "advised", 100, now);
    expect(offer).toMatchObject({ units: 100, unitCents: 300, reason: null });
    expect(offer.customerDemand).toBeUndefined();
  });

  it("rounds partial-quota half cents exactly like PostgreSQL", () => {
    const request = { ...snapshot().requests[2], bonusPercent: 5, remainingUnits: 7, matchedFlavorCount: 1 as const };
    expect(getKqCustomerDemandPrice(210, 64, request).unitCents).toBe(211.148438);
    expect(getKqCustomerDemandPrice(210, 64, { ...request, bonusPercent: 7.5 }).unitCents).toBe(211.722656);
    expect(getKqCustomerDemandPrice(300, 128, { ...request, bonusPercent: 12.5 }).unitCents).toBe(302.050781);
    const state = commerce();
    state.customerDemand!.requests[2].bonusPercent = 10;
    state.customerDemand!.requests[2].remainingUnits = 3;
    const partialStock = { ...stock, varietyCode: "HH2026-013" };
    expect(quoteKqCommerce(state, partialStock, "wholesale", "advised", 33, now)).toMatchObject({ unitCents: 210.954545, payoutExactAfter: 696.149999 });
    expect(quoteKqCommerce(state, { ...partialStock, payoutExact: 0.000001 }, "wholesale", "advised", 33, now).payoutExactAfter).toBe(696.15);
  });

  it("keeps online prices free while raising willingness to pay for one or two aromas", () => {
    const none = forecast("HH2026-007"), one = forecast("HH2026-013"), two = forecast("HH2026-025");
    expect([none.referencePacketPriceCents, one.referencePacketPriceCents, two.referencePacketPriceCents]).toEqual([4000, 4400, 4800]);
    expect(none.ordersPerDay).toBeGreaterThan(0);
    expect(one.ordersPerDay).toBeGreaterThan(none.ordersPerDay);
    expect(two.ordersPerDay).toBeGreaterThan(one.ordersPerDay);
    expect([none.netBeforeProductionCents, one.netBeforeProductionCents, two.netBeforeProductionCents]).toEqual([3208, 3208, 3208]);
    const exhausted = snapshot(); exhausted.requests[0].remainingUnits = 0;
    expect(forecast("HH2026-025", exhausted)).toEqual(forecast("HH2026-007", exhausted));
  });

  it("uses 7/8/10 euro indoor references without adding packaging or reputation to the price", () => {
    for (const [quality, reference] of [[8.49, 3500], [8.5, 4000], [9.49, 4000], [9.5, 5000]]) {
      expect(forecast("HH2026-007", snapshot(), quality).referencePacketPriceCents).toBe(reference);
      const offer = estimateKqOnlineOffer({ route: "raw", quality, baseUnitCents: 180, formatGrams: 5, packagingCode: "glass-5",
        packetPriceCents: reference, reputation: 100000, clients: 0, online: createKqOnlinePreview(now) });
      expect(offer.referencePacketPriceCents).toBe(reference);
    }
  });
});
