import { describe, expect, it } from "vitest";
import { createKqBusinessPreview, getKqAdvertisingMultiplier, getKqBusinessClock, getKqSaleVatCents,
  isKqShopActive, KQ_GAME_DAY_MS, KQ_GAME_MONTH_MS, normalizeKqShopName, previewKqBusinessPayment } from "./kanab-quest-business";
import { getKqCommerceReplenishment, quoteKqCommerce, type KqCommerceState, type KqCommerceStock } from "./kanab-quest-commerce";

const start = Date.parse("2026-10-24T22:00:00Z");
const iso = (time: number) => new Date(time).toISOString();
const stock: KqCommerceStock = { id: "stock", flowerId: "flower", name: "Test", route: "raw", batchRoute: "raw", juryScore: 8,
  initialUnits: 10000, remainingUnits: 10000, equivalentUnits: 10000, originalUnits: 10000, baseUnitCents: 180,
  repExact: 0, repRounded: 0, professionalUnits: 0, counted: false };
function account(): KqCommerceState {
  const business = createKqBusinessPreview(start);
  business.shop = { name: "Mon shop", createdAt: iso(start), paidUntil: iso(start + KQ_GAME_MONTH_MS), active: true, renew: true };
  return { revision: 0, cashCents: 20000, reputation: 0, clients: 0, computerOwned: true, internetRenew: false,
    campaign: { id: "run", revision: 0, reputation: 0, clientsStart: 0, event: "normal", internetPaid: true,
      directUsed: 0, shopUsed: 0, goodUnits: 0, disappointmentUnits: 0 },
    stocks: [stock], receipts: [], marketVolumes: {}, ownVolumes: {}, routeSales: {}, business,
    demand: { serverNow: iso(start), updatedAt: iso(start), onlineDebt: 0, shopDebt: 0, growthResetsAt: iso(start + 86400000) } };
}

describe("business calendar and billing previews", () => {
  it("uses elapsed real hours across month and DST boundaries, never local dates", () => {
    expect(getKqBusinessClock(iso(start), start)).toMatchObject({ day: 1, dayOfMonth: 1, month: 1 });
    expect(getKqBusinessClock(iso(start), start + 86400000)).toMatchObject({ day: 7, dayOfMonth: 7, month: 1 });
    expect(getKqBusinessClock(iso(start), start + KQ_GAME_MONTH_MS - 1)).toMatchObject({ day: 30, month: 1 });
    expect(getKqBusinessClock(iso(start), start + KQ_GAME_MONTH_MS)).toMatchObject({ day: 31, dayOfMonth: 1, month: 2 });
    expect(getKqBusinessClock(iso(start), start - 1).day).toBe(1);
    expect(() => getKqBusinessClock("bad", start)).toThrow();
  });
  it("keeps names readable and counts Unicode characters rather than UTF-16 units", () => {
    expect(normalizeKqShopName("  La   Récolte  ")).toBe("La Récolte");
    expect(normalizeKqShopName("Cafe\u0301 des amis")).toBe("Café des amis");
    expect(normalizeKqShopName("🌱".repeat(40))).toHaveLength(80);
    for (const name of ["ab", "x".repeat(41), "abc\nabc", "a\u200bb", "<shop>", 123]) {
      expect(() => normalizeKqShopName(name)).toThrow();
    }
  });
  it("reserves included VAT on every cent without rewarding split sales", () => {
    expect(getKqSaleVatCents(12000, 0)).toBe(2000);
    let prior = 0, tax = 0;
    for (const sale of [1, 1, 1, 4, 13, 77, 12000, 17]) { tax += getKqSaleVatCents(sale, prior); prior += sale; }
    expect(tax).toBe(getKqSaleVatCents(prior, 0));
    expect(() => getKqSaleVatCents(-1, 0)).toThrow();
    expect(() => getKqSaleVatCents(1.5, 0)).toThrow();
  });
  it("shares the 50% collection ceiling after VAT with overdue lab first", () => {
    const business = createKqBusinessPreview(start);
    business.lab.overdueCents = 4500;
    expect(previewKqBusinessPayment(30000, business, 20000)).toEqual({ vatCents: 5000, labPaidCents: 4500,
      electricityPaidCents: 8000, netPayoutCents: 12500, electricityRemainingCents: 12000 });
    business.lab.overdueCents = 0;
    business.lab.outstandingCents = 4500;
    expect(previewKqBusinessPayment(12000, business, 0)).toMatchObject({ labPaidCents: 0, vatCents: 2000, netPayoutCents: 10000 });
  });
});

describe("shop gate and advertising demand", () => {
  it("requires a purchased, paid site even when legacy Internet was enabled", () => {
    const state = account();
    state.business = createKqBusinessPreview(start);
    expect(quoteKqCommerce(state, stock, "online").reason).toContain("1 000 €");
    expect(quoteKqCommerce(state, stock, "cbd-shop").reason).toBeNull();
    expect(quoteKqCommerce(state, stock, "wholesale").reason).toBeNull();
    const paid = account();
    expect(isKqShopActive(paid.business!, start + KQ_GAME_MONTH_MS - 1)).toBe(true);
    expect(isKqShopActive(paid.business!, start + KQ_GAME_MONTH_MS)).toBe(false);
    expect(quoteKqCommerce(paid, stock, "online", "advised", undefined, start + KQ_GAME_MONTH_MS).reason).toContain("Réactive");
  });
  it("keeps consumed demand through the start and end of advertising", () => {
    const state = account();
    state.demand!.onlineDebt = 0.5; // 20 g already consumed out of the unboosted 40 g.
    state.business!.advertising = { id: "ad", kind: "instagram", boostPercent: 50, startedAt: iso(start), endsAt: iso(start + 7 * KQ_GAME_DAY_MS) };
    expect(getKqAdvertisingMultiplier(state.business)).toBe(1.5);
    expect(quoteKqCommerce(state, stock, "online").maxUnits).toBe(400); // 60 - 20 g.
    expect(quoteKqCommerce(state, stock, "cbd-shop").maxUnits).toBe(4000);
    state.demand!.updatedAt = iso(start + 7 * KQ_GAME_DAY_MS);
    state.demand!.onlineDebt = 1.5; // Advertising has just ended after a full bucket was sold.
    const afterEnd = start + 7 * KQ_GAME_DAY_MS;
    expect(getKqCommerceReplenishment(state, "online", afterEnd)).toMatchObject({ availableFraction: 0, remainingMs: 6 * 3600000 });
    expect(getKqCommerceReplenishment(state, "online", afterEnd + 2 * 3600000)!.availableFraction).toBe(0);
    expect(getKqCommerceReplenishment(state, "online", afterEnd + 6 * 3600000)!.availableFraction).toBe(1);
  });
  it("integrates the boosted and normal refill on either side of expiry", () => {
    const state = account();
    state.demand!.onlineDebt = 2;
    state.business!.advertising = { id: "ad", kind: "radio", boostPercent: 100, startedAt: iso(start), endsAt: iso(start + 3600000) };
    expect(getKqCommerceReplenishment(state, "online", start)!.remainingMs).toBe(7 * 3600000);
    expect(getKqCommerceReplenishment(state, "online", start + 3 * 3600000)!.availableFraction).toBe(0);
    expect(getKqCommerceReplenishment(state, "online", start + 7 * 3600000)!.availableFraction).toBe(1);
    state.business!.shop.paidUntil = iso(start);
    expect(getKqAdvertisingMultiplier(state.business)).toBe(1);
  });
});
