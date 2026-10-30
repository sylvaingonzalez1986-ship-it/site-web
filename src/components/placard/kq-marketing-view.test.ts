import { describe, expect, it } from "vitest";
import { createKqBusinessPreview } from "@/lib/kanab-quest-business";
import type { KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import { createKqCustomerDemandSnapshot } from "@/lib/kanab-quest-customer-demand";
import { getKqMarketingPreview } from "@/lib/kanab-quest-marketing";
import { createKqOnlinePreview } from "@/lib/kanab-quest-online";
import { getKqMarketingView } from "./kq-marketing-view";

const NOW = Date.parse("2026-10-15T12:00:00Z");
function state(): KqCommerceSnapshot {
  const online = createKqOnlinePreview(NOW), business = createKqBusinessPreview(NOW);
  online.listings = [{ id: "listing", stockId: "stock", name: "Récolte", route: "raw", formatGrams: 5,
    packagingCode: "kraft-5", packetPriceCents: 3500, initialPackets: 30, remainingPackets: 30, soldPackets: 0,
    status: "active", qualityScore: 8, baseUnitCents: 180, createdAt: new Date(NOW).toISOString() }];
  business.shop = { ...business.shop, name: "Atelier", createdAt: online.site.createdAt, active: true, tier: "basic" };
  return { online, business, cashCents: 100000, reputation: 0, clients: 0, revision: 0, computerOwned: true, internetRenew: false,
    campaign: null, stocks: [], receipts: [], rawLots: [], electricityOutstandingCents: 0, marketVolumes: {}, ownVolumes: {}, routeSales: {} };
}
const input = (data = state()) => ({ data, code: "behind-scenes" as const, angle: "craft" as const, listingId: "listing", budgetCode: "regional" as const });

describe("Marketing planning presentation", () => {
  it("retains the domain estimate, exact debit and immutable snapshot", () => {
    const request = input(), before = structuredClone(request.data);
    const view = getKqMarketingView(request);
    expect(view.preview).toEqual(getKqMarketingPreview(request));
    expect(view).toMatchObject({ costCents: 8000, canLaunch: true, marketingKnown: true, dataIssues: [], blockingReasons: [] });
    expect(request.data).toEqual(before);
  });

  it("uses only the first eligible real listing when the selected listing disappears", () => {
    const data = state(), row = data.online!.listings[0];
    data.online!.listings = [{ ...row, id: "paused", status: "paused" }, { ...row, id: "degraded", qualityScore: 5.7 }, { ...row, id: "available" }];
    const view = getKqMarketingView(input(data));
    expect(view.listings?.map(item => item.id)).toEqual(["available"]);
    expect(view.listing?.id).toBe("available");
    expect(view.preview?.listing?.id).toBe("available");
  });

  it("normalizes the free introduction and the already consumed introduction without phantom reuse", () => {
    const request = { ...input(), code: "introduction" as const, budgetCode: "national" as const };
    expect(getKqMarketingView(request)).toMatchObject({ selectedCode: "introduction", selectedBudget: "local", costCents: 0, canLaunch: true });
    request.data.online!.marketing.completedCodes.push("introduction");
    expect(getKqMarketingView(request)).toMatchObject({ selectedCode: "harvest", selectedBudget: "national", costCents: 18000, canLaunch: true });
  });

  it("distinguishes no stock from unknown stock and never shows a zero forecast for either", () => {
    const data = state();
    data.online!.listings = [];
    expect(getKqMarketingView(input(data))).toMatchObject({ listings: [], listing: null, preview: null, canLaunch: false, dataIssues: [] });
    expect(getKqMarketingView(input(data)).blockingReasons.join(" ")).toContain("Mets des paquets en vente");
    Object.assign(data.online!, { listings: undefined });
    const unavailable = getKqMarketingView(input(data));
    expect(unavailable).toMatchObject({ listings: null, listing: null, preview: null, canLaunch: false });
    expect(unavailable.blockingReasons.join(" ")).toContain("stock en vente est incomplet");
  });

  it.each([
    ["cash", (data: KqCommerceSnapshot) => { data.cashCents = NaN; }, "trésorerie"],
    ["clock", (data: KqCommerceSnapshot) => { data.online!.serverNow = "invalid"; }, "heure"],
    ["followers", (data: KqCommerceSnapshot) => { Object.assign(data.online!, { followers: undefined }); }, "audience"],
    ["confidence", (data: KqCommerceSnapshot) => { data.online!.confidence = 101; }, "confiance"],
    ["clients", (data: KqCommerceSnapshot) => { data.clients = Infinity; }, "audience"],
    ["orders", (data: KqCommerceSnapshot) => { data.online!.stats.orders = NaN; }, "commandes"],
    ["studio", (data: KqCommerceSnapshot) => { data.online!.studio!.levels.editorial = 8; }, "améliorations"],
    ["price", (data: KqCommerceSnapshot) => { data.online!.listings[0].packetPriceCents = NaN; }, "stock"],
    ["packaging", (data: KqCommerceSnapshot) => { data.online!.listings[0].formatGrams = 10; }, "stock"],
    ["creation date", (data: KqCommerceSnapshot) => { data.online!.listings[0].createdAt = "invalid"; }, "stock"],
    ["active state", (data: KqCommerceSnapshot) => { Object.assign(data.online!.marketing, { active: undefined }); }, "campagnes"],
    ["completed state", (data: KqCommerceSnapshot) => { Object.assign(data.online!.marketing, { completedCodes: {} }); }, "campagnes"],
    ["cooldown date", (data: KqCommerceSnapshot) => { data.online!.marketing.cooldowns.harvest = "invalid"; }, "campagnes"],
  ] as const)("keeps unknown %s from producing a forecast or enabled debit", (_name, corrupt, message) => {
    const data = state();
    corrupt(data);
    const view = getKqMarketingView(input(data));
    expect(view.preview).toBeNull();
    expect(view.canLaunch).toBe(false);
    expect(view.costCents).toBe(8000);
    expect(view.blockingReasons.join(" ")).toContain(message);
  });

  it("accepts legacy optional fields and every real transformed product route", () => {
    const data = state();
    delete data.business;
    delete data.online!.studio;
    data.online!.listings[0].route = "rosin-premium";
    expect(getKqMarketingView(input(data))).toMatchObject({ canLaunch: true, dataIssues: [] });
  });

  it("preserves valid zero audience and a negative contribution instead of hiding an unfavourable campaign", () => {
    const data = state();
    data.online!.listings[0].packetPriceCents = 1_000_000;
    const view = getKqMarketingView(input(data));
    expect(view.canLaunch).toBe(true);
    expect(view.preview).toMatchObject({ projectedExtraOrders: 0, expectedFollowers: 0, netAfterCampaignCents: -8000 });
  });

  it("keeps known insufficient cash, suspension and the exact cooldown among visible reasons", () => {
    const data = state();
    data.cashCents = 100;
    data.online!.site.active = false;
    data.online!.marketing.cooldowns["behind-scenes"] = "2026-10-18T12:00:00Z";
    const view = getKqMarketingView(input(data));
    expect(view.preview).not.toBeNull();
    expect(view.canLaunch).toBe(false);
    expect(view.blockingReasons.join(" ")).toContain("trésorerie");
    expect(view.blockingReasons.join(" ")).toContain("réactive");
    expect(view.blockingReasons.join(" ")).toContain("18 octobre 2026");
    expect(view.blockingReasons.join(" ")).toContain("14:00");
  });

  it("guards supplied demand while retaining a valid limited market premium", () => {
    const data = state();
    data.customerDemand = createKqCustomerDemandSnapshot(NOW);
    const view = getKqMarketingView(input(data));
    expect(view.preview).toEqual(getKqMarketingPreview(input(data)));
    Object.assign(data.customerDemand, { requests: null });
    expect(getKqMarketingView(input(data))).toMatchObject({ preview: null, canLaunch: false });
  });

  it("retains advertising for advanced shop tiers and rejects a malformed paid advertising campaign", () => {
    const data = state();
    data.business!.shop.tier = "signature";
    data.business!.shop.paidUntil = new Date(NOW + 72 * 3_600_000).toISOString();
    data.business!.advertising = { id: "ad", kind: "radio", startedAt: new Date(NOW).toISOString(), endsAt: data.business!.shop.paidUntil, boostPercent: 100 };
    expect(getKqMarketingView(input(data))).toMatchObject({ canLaunch: true, dataIssues: [] });
    Object.assign(data.business!.advertising, { kind: "invalid" });
    expect(getKqMarketingView(input(data))).toMatchObject({ preview: null, canLaunch: false });
  });

  it("accepts a fully packed harvest without bulk stock and keeps the server history check", () => {
    const data = state();
    const view = getKqMarketingView({ ...input(data), code: "harvest" });
    expect(view.canLaunch).toBe(true);
    Object.assign(data, { stocks: undefined });
    expect(getKqMarketingView({ ...input(data), code: "harvest" })).toMatchObject({ preview: null, canLaunch: false });
    expect(getKqMarketingView(input(data)).canLaunch).toBe(true);
  });
});
