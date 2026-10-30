import { describe, expect, it } from "vitest";
import { createKqOnlinePreview, type KqOnlineListing } from "./kanab-quest-online";
import { getKqHubSalesAttention } from "./kanab-quest-hub-sales";

const now = Date.parse("2026-10-29T12:00:00.000Z");
const listing = (changes: Partial<KqOnlineListing> = {}): KqOnlineListing => ({
  id: "first-listing", stockId: "first-product", name: "Futura 75", route: "raw", formatGrams: 5,
  packagingCode: "kraft-5", packetPriceCents: 1800, initialPackets: 9, remainingPackets: 7, soldPackets: 2,
  status: "active", qualityScore: 7, baseUnitCents: 300, createdAt: new Date(now - 86400000).toISOString(), ...changes,
});
function snapshot(listings: KqOnlineListing[] = [listing()], active = true) {
  const online = createKqOnlinePreview(now);
  online.site.active = active;
  online.listings = listings;
  return { online };
}

describe("Quartier only surfaces proven current sales blockers", () => {
  it("targets the exact affected announcement despite a same-variety neighbour, without mutation", () => {
    const payload = snapshot([listing(), listing({ id: "aged-listing", qualityScore: 5.7, status: "quality-blocked", remainingPackets: 3 })]);
    const before = structuredClone(payload);
    expect(getKqHubSalesAttention(payload)).toMatchObject({ complete: true, notice: {
      id: "sales-quality", destination: "market", options: { marketSection: "dashboard", listingId: "aged-listing" },
    } });
    expect(getKqHubSalesAttention(payload).notice?.description).toContain("3 paquets");
    expect(payload).toEqual(before);
  });

  it("respects the exact online threshold, without deriving it from a rounded display or the device clock", () => {
    expect(getKqHubSalesAttention(snapshot([listing({ qualityScore: 5.8 })]))).toEqual({ notice: null, complete: true });
    expect(getKqHubSalesAttention(snapshot([listing({ qualityScore: 5.799 })])).notice?.id).toBe("sales-quality");
    expect(getKqHubSalesAttention(snapshot([listing({ qualityScore: 5.8 })], false)).notice?.id).toBe("sales-suspended");
  });

  it("keeps a score just below the gate blocked without displaying a contradictory rounded score", () => {
    const payload = snapshot([listing({ qualityScore: 5.7999 })]);
    const result = getKqHubSalesAttention(payload);
    expect(result.notice?.id).toBe("sales-quality");
    expect(result.notice?.description).toContain("qualité inférieure à 5,8/10");
    expect(result.notice?.description).not.toContain("5,7999");
    expect(payload.online.listings[0].qualityScore).toBe(5.7999);
    expect(getKqHubSalesAttention(snapshot([listing({ qualityScore: 5.7111 })])).notice?.description).toContain("qualité 5,71/10");
  });

  it.each(["paused", "closed", "sold-out", "discarded"] as const)("does not interrupt a %s choice or history, even below the quality gate on a suspended site", status => {
    expect(getKqHubSalesAttention(snapshot([listing({ status, qualityScore: 4 })], false))).toEqual({ notice: null, complete: true });
  });

  it("requires a real existing suspended site and active saleable-quality packets, without recommending an upgrade", () => {
    const payload = snapshot([listing()], false);
    expect(getKqHubSalesAttention(payload)).toMatchObject({ complete: true, notice: {
      id: "sales-suspended", buttonLabel: "Vérifier ma boutique", destination: "market", options: { marketSection: "management" },
    } });
    payload.online.site.createdAt = null;
    expect(getKqHubSalesAttention(payload)).toEqual({ notice: null, complete: true });
    payload.online.site.createdAt = new Date(now).toISOString();
    payload.online.listings = [];
    expect(getKqHubSalesAttention(payload)).toEqual({ notice: null, complete: true });
    payload.online.listings = [listing({ remainingPackets: 0 })];
    expect(getKqHubSalesAttention(payload)).toEqual({ notice: null, complete: true });
  });

  it("shows a known quality blocker before suspension without implying reactivation will repair the packets", () => {
    const result = getKqHubSalesAttention(snapshot([listing(), listing({ id: "aged", qualityScore: 5.7, status: "quality-blocked" })], false));
    expect(result.notice?.id).toBe("sales-quality");
    expect(result.notice?.options).toEqual({ marketSection: "dashboard", listingId: "aged" });
  });

  it.each([null, {}, { online: null }, { online: { version: 1 } }, { online: { version: 2, serverNow: new Date(now).toISOString(), listings: [] } }])("does not read absent or incompatible online data as no blocked sales: %j", payload => {
    expect(getKqHubSalesAttention(payload)).toEqual({ notice: null, complete: false });
  });

  it.each([undefined, null, -1, Infinity, NaN, "7", 1.2])("keeps unreadable remaining packets unknown: %s", remainingPackets => {
    const payload = snapshot([], false);
    const malformed = { ...payload, online: { ...payload.online, listings: [{ ...listing({ qualityScore: 5.5 }), remainingPackets }] } };
    expect(getKqHubSalesAttention(malformed)).toEqual({ notice: null, complete: false });
  });

  it("preserves a confirmed local blocker while marking another malformed row incomplete", () => {
    const payload = snapshot([listing({ qualityScore: 5.5 })]);
    const result = getKqHubSalesAttention({ ...payload, online: { ...payload.online, listings: [...payload.online.listings, null] } });
    expect(result).toMatchObject({ complete: false, notice: { id: "sales-quality", options: { listingId: "first-listing" } } });
  });

  it("does not choose an ambiguous listing identity or invent a quality score for legacy partial records", () => {
    const duplicated = snapshot([listing({ qualityScore: 5.5 }), listing()]);
    expect(getKqHubSalesAttention(duplicated)).toEqual({ notice: null, complete: false });
    for (const changes of [{ id: "" }, { name: "" }, { qualityScore: undefined }, { qualityScore: -1 }, { qualityScore: 11 }, { status: "unknown" }]) {
      const payload = snapshot();
      expect(getKqHubSalesAttention({ ...payload, online: { ...payload.online, listings: [{ ...listing(), ...changes }] } })).toEqual({ notice: null, complete: false });
    }
  });

  it("does not fabricate a site suspension or accept contradictory server state", () => {
    const payload = snapshot([listing()], false);
    for (const site of [undefined, {}, { active: false }, { active: false, createdAt: "unknown" }, { active: true, createdAt: null }]) {
      expect(getKqHubSalesAttention({ ...payload, online: { ...payload.online, site } })).toEqual({ notice: null, complete: false });
    }
    expect(getKqHubSalesAttention(snapshot([listing({ status: "quality-blocked", qualityScore: 8 })]))).toEqual({ notice: null, complete: false });
  });

  it("can identify a quality failure without fabricating the missing boutique state", () => {
    const payload = snapshot([listing({ qualityScore: 5.5 })]);
    expect(getKqHubSalesAttention({ ...payload, online: { ...payload.online, site: undefined } })).toMatchObject({ complete: false, notice: { id: "sales-quality" } });
    expect(getKqHubSalesAttention({ ...payload, online: { ...payload.online, serverNow: "unknown" } })).toEqual({ notice: null, complete: false });
  });
});
