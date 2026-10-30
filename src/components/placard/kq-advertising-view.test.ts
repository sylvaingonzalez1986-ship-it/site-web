import { describe, expect, it } from "vitest";
import { createKqBusinessPreview, KQ_ADVERTISING, KQ_GAME_DAY_MS, type KqAdvertisingKind } from "@/lib/kanab-quest-business";
import type { KqCommerceSnapshot } from "@/lib/kanab-quest-commerce";
import { createKqOnlinePreview, type KqOnlineListing } from "@/lib/kanab-quest-online";
import { getKqAdvertisingView } from "./kq-advertising-view";

// The daylight-saving change must not change a purchased real-hour duration.
const NOW = Date.parse("2026-10-24T22:00:00Z"), HOUR = 3_600_000;
const iso = (at: number) => new Date(at).toISOString();
function state(): KqCommerceSnapshot {
  const business = createKqBusinessPreview(NOW), online = createKqOnlinePreview(NOW);
  business.shop = { ...business.shop, name: "Atelier", tier: "basic", createdAt: iso(NOW), active: true };
  return { business, online, cashCents: 100_000, reputation: 0, clients: 0, revision: 0, computerOwned: true,
    internetRenew: false, campaign: null, stocks: [], receipts: [], rawLots: [], electricityOutstandingCents: 0,
    marketVolumes: {}, ownVolumes: {}, routeSales: {} };
}
function active(data = state()) {
  data.business!.advertising = { id: "ad", kind: "instagram", startedAt: iso(NOW - HOUR), endsAt: iso(NOW + 27 * HOUR), boostPercent: 50 };
  return data;
}
const view = (data = state(), kind: KqAdvertisingKind = "flyers", now?: number) => getKqAdvertisingView({ data, kind, now });

describe("General advertising presentation", () => {
  it.each(Object.keys(KQ_ADVERTISING) as KqAdvertisingKind[])("preserves the %s debit and elapsed duration across DST", kind => {
    const data = state(), before = structuredClone(data), definition = KQ_ADVERTISING[kind];
    expect(view(data, kind)).toMatchObject({ kind, definition, canLaunch: true, dataIssues: [], blockingReasons: [],
      endsAt: iso(NOW + definition.durationDays * KQ_GAME_DAY_MS), cashCents: 100_000, missingCents: 0,
      siteState: "active", advertisingState: "none", currentBoostPercent: 0 });
    expect(data).toEqual(before);
  });

  it("retains the server's current bonus and dates without substituting catalogue values", () => {
    const data = active(), before = structuredClone(data);
    data.business!.advertising!.boostPercent = 35;
    const result = view(data);
    expect(result).toMatchObject({ advertisingState: "active", currentBoostPercent: 35, remainingMs: 27 * HOUR,
      durationMs: 28 * HOUR, canLaunch: false, definition: KQ_ADVERTISING.flyers });
    expect(result.advertising).toEqual({ ...before.business!.advertising, boostPercent: 35 });
    expect(data.business!.advertising!.boostPercent).toBe(35);
  });

  it("keeps a known zero bonus and does not infer a paid amount from the catalogue", () => {
    const data = active(); data.business!.advertising!.boostPercent = 0;
    expect(view(data)).toMatchObject({ advertisingState: "active", currentBoostPercent: 0, canLaunch: false });
    expect(view(data).advertising).not.toHaveProperty("costCents");
  });

  it("does not release an expired snapshot until the server has cleared it", () => {
    const data = active(); data.business!.advertising!.endsAt = iso(NOW);
    expect(view(data)).toMatchObject({ advertisingState: "ended", remainingMs: 0, currentBoostPercent: 0, canLaunch: false });
    expect(view(data).blockingReasons.join(" ")).toContain("Actualise");
    expect(data.business!.advertising).not.toBeNull();
    data.business!.advertising = null;
    expect(view(data)).toMatchObject({ advertisingState: "none", canLaunch: true });
  });

  it("retains a future campaign without activating its bonus or allowing replacement", () => {
    const data = active(); data.business!.advertising!.startedAt = iso(NOW + HOUR);
    expect(view(data)).toMatchObject({ advertisingState: "scheduled", remainingMs: 27 * HOUR, currentBoostPercent: 0, canLaunch: false });
  });

  it("keeps the paid campaign running while the site is suspended", () => {
    const data = active(); data.online!.site.active = false;
    expect(view(data)).toMatchObject({ siteState: "inactive", advertisingState: "active", currentBoostPercent: 0,
      remainingMs: 27 * HOUR, canLaunch: false });
    expect(view(data).advertising?.boostPercent).toBe(50);
  });

  it("uses a monotonic supplied clock and never falls back from an invalid supplied clock", () => {
    const data = active();
    expect(view(data, "flyers", NOW - HOUR).now).toBe(NOW);
    expect(view(data, "flyers", NOW + HOUR).remainingMs).toBe(26 * HOUR);
    expect(view(data, "flyers", NaN)).toMatchObject({ now: null, advertisingState: "unavailable", currentBoostPercent: null, canLaunch: false });
    expect(view(data, "flyers", Infinity).endsAt).toBeNull();
  });

  it.each([undefined, null, NaN, Infinity, -1, 10.5, "6000", Number.MAX_SAFE_INTEGER + 1])("does not turn unknown cash %s into zero or permission to debit", cashCents => {
    const data = state(); Object.assign(data, { cashCents });
    const result = view(data);
    expect(result).toMatchObject({ cashCents: null, missingCents: null, canLaunch: false, definition: KQ_ADVERTISING.flyers });
    expect(result.blockingReasons.join(" ")).toContain("trésorerie disponible est inconnue");
  });

  it("preserves known zero and the exact shortfall instead of treating them as missing", () => {
    const data = state(); data.cashCents = 0;
    expect(view(data)).toMatchObject({ cashCents: 0, missingCents: 6000, dataIssues: [], canLaunch: false });
    data.cashCents = 5999;
    expect(view(data)).toMatchObject({ missingCents: 1, canLaunch: false });
    data.cashCents = 6000;
    expect(view(data)).toMatchObject({ missingCents: 0, canLaunch: true });
  });

  it.each([
    ["missing campaign", (data: KqCommerceSnapshot) => { Object.assign(data.business!, { advertising: undefined }); }],
    ["unknown kind", (data: KqCommerceSnapshot) => { Object.assign(data.business!.advertising!, { kind: "constructor" }); }],
    ["missing bonus", (data: KqCommerceSnapshot) => { Object.assign(data.business!.advertising!, { boostPercent: undefined }); }],
    ["invalid bonus", (data: KqCommerceSnapshot) => { data.business!.advertising!.boostPercent = NaN; }],
    ["missing beginning", (data: KqCommerceSnapshot) => { data.business!.advertising!.startedAt = "invalid"; }],
    ["invalid end", (data: KqCommerceSnapshot) => { data.business!.advertising!.endsAt = "invalid"; }],
    ["reversed interval", (data: KqCommerceSnapshot) => { data.business!.advertising!.endsAt = iso(NOW - 2 * HOUR); }],
    ["unknown version", (data: KqCommerceSnapshot) => { Object.assign(data.business!, { version: 2 }); }],
    ["missing business", (data: KqCommerceSnapshot) => { delete data.business; }],
  ] as const)("keeps %s unavailable rather than advertising an empty slot", (_name, corrupt) => {
    const data = active(); corrupt(data);
    expect(view(data)).toMatchObject({ advertisingState: "unavailable", currentBoostPercent: null, canLaunch: false });
    expect(view(data).blockingReasons.length).toBeGreaterThan(0);
  });

  it.each([
    ["server clock", (data: KqCommerceSnapshot) => { data.business!.serverNow = "invalid"; }],
    ["site active", (data: KqCommerceSnapshot) => { Object.assign(data.online!.site, { active: undefined }); }],
    ["site creation", (data: KqCommerceSnapshot) => { data.online!.site.createdAt = "invalid"; }],
    ["site tier", (data: KqCommerceSnapshot) => { Object.assign(data.online!.site, { tier: "invented" }); }],
    ["site missing", (data: KqCommerceSnapshot) => { Object.assign(data.online!, { site: undefined }); }],
  ] as const)("keeps unknown %s distinct from a suspended site", (_name, corrupt) => {
    const data = active(); corrupt(data);
    expect(view(data)).toMatchObject({ siteState: "unknown", currentBoostPercent: null, canLaunch: false });
  });

  it("does not promise a date when adding the purchased duration overflows the date range", () => {
    const data = state(); data.business!.serverNow = iso(8_640_000_000_000_000 - HOUR);
    expect(view(data)).toMatchObject({ endsAt: null, canLaunch: false });
  });

  it("does not warn about subscription expiry on the free basic site", () => {
    const data = state(); data.online!.site.paidUntil = iso(NOW - HOUR);
    expect(view(data)).toMatchObject({ siteState: "active", subscriptionEndsFirst: false, canLaunch: true });
  });

  it("warns at a paid tier's deadline without inventing a successful renewal", () => {
    const data = state();
    data.online!.site = { ...data.online!.site, tier: "signature", renew: true, paidUntil: iso(NOW + HOUR) };
    expect(view(data)).toMatchObject({ siteState: "active", subscriptionEndsFirst: true, canLaunch: true });
    data.online!.site.paidUntil = iso(NOW + 40 * HOUR);
    expect(view(data).subscriptionEndsFirst).toBe(false);
    data.online!.site.paidUntil = iso(NOW);
    expect(view(data)).toMatchObject({ siteState: "inactive", canLaunch: false });
    data.online!.site.paidUntil = null;
    expect(view(data)).toMatchObject({ siteState: "unknown", subscriptionEndsFirst: null, canLaunch: false });
  });

  it("preserves the historical paid-site contract without requiring online features", () => {
    const data = state(); delete data.online; delete data.business!.shop.tier;
    data.business!.shop.paidUntil = iso(NOW + 120 * HOUR);
    expect(view(data)).toMatchObject({ siteState: "active", canLaunch: true, activeFlowerListings: null, subscriptionEndsFirst: false });
    data.business!.shop.paidUntil = "invalid";
    expect(view(data)).toMatchObject({ siteState: "unknown", canLaunch: false });
  });

  it("distinguishes an empty, inactive, degraded and unreadable stock without making stock a purchase gate", () => {
    const data = state();
    expect(view(data)).toMatchObject({ activeFlowerListings: 0, canLaunch: true });
    const listing = { id: "live", stockId: "stock", name: "Récolte", route: "raw", formatGrams: 5,
      packagingCode: "kraft-5", packetPriceCents: 3500, initialPackets: 10, remainingPackets: 10, soldPackets: 0,
      status: "active", qualityScore: 8, baseUnitCents: 180, createdAt: iso(NOW) } satisfies KqOnlineListing;
    data.online!.listings = [listing, { ...listing, id: "paused", status: "paused" }, { ...listing, id: "degraded", qualityScore: 5.7 }];
    expect(view(data)).toMatchObject({ activeFlowerListings: 1, canLaunch: true });
    Object.assign(data.online!, { listings: undefined });
    expect(view(data)).toMatchObject({ activeFlowerListings: null, canLaunch: true });
  });

  it("does not silently replace an unknown purchase kind with a catalogue offer", () => {
    expect(view(state(), "constructor" as KqAdvertisingKind)).toMatchObject({ kind: null, definition: null, canLaunch: false, endsAt: null });
  });
});
