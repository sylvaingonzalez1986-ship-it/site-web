import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), insert: vi.fn(), energy: vi.fn(), market: vi.fn() }));
vi.mock("./admin", () => ({ createSupabaseServiceClient: () => ({ rpc: mocks.rpc, from: () => ({ insert: mocks.insert }) }) }));
vi.mock("./kanab-quest-energy-backend", () => ({ getKqEnergySummary: mocks.energy }));
vi.mock("./kanab-quest-market-backend", () => ({ getKqMarketSnapshot: mocks.market }));
import { createKqBusinessPreview, KQ_GAME_MONTH_MS } from "../kanab-quest-business";
import { getKqCommerceSnapshot, handleKqCommerceAction } from "./kanab-quest-commerce-backend";
import type { KqCommerceState } from "../kanab-quest-commerce";
const user = "11111111-1111-4111-8111-111111111111";
const stockId = "22222222-2222-4222-8222-222222222222";
const now = Date.parse("2026-09-21T12:00:00Z");
function snapshot(): KqCommerceState {
  const business = createKqBusinessPreview(now);
  business.shop = { name: "Mon shop", createdAt: new Date(now).toISOString(), paidUntil: new Date(now + KQ_GAME_MONTH_MS).toISOString(), active: true, renew: true };
  return { business, revision: 1, cashCents: 10000, reputation: 0, clients: 0, computerOwned: true, internetRenew: false,
    campaign: { id: user, revision: 1, reputation: 0, clientsStart: 0, event: "normal", internetPaid: true, directUsed: 0, shopUsed: 0, goodUnits: 0, disappointmentUnits: 0 },
    stocks: [{ id: stockId, flowerId: user, name: "Test", route: "raw", batchRoute: "raw", juryScore: 8, initialUnits: 1200,
      remainingUnits: 1200, equivalentUnits: 1200, originalUnits: 1200, baseUnitCents: 180, repExact: 0, repRounded: 0, professionalUnits: 0, counted: false }],
    receipts: [], marketVolumes: {}, ownVolumes: {}, routeSales: {},
    demand: { serverNow: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(), onlineDebt: 0, shopDebt: 0, growthResetsAt: new Date(now + 86400000).toISOString() } };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ data: snapshot(), error: null });
  mocks.insert.mockResolvedValue({ error: null });
  mocks.energy.mockResolvedValue({ outstandingCents: 20000 });
  mocks.market.mockResolvedValue({ lots: [] });
});

describe("business actions use authoritative commands", () => {
  it("normalizes the shop name and never forwards a client supplied creation price", async () => {
    await handleKqCommerceAction(user, { action: "create-shop", name: "  Mes   fleurs  ", costCents: 0, requestKey: user });
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_kq_commerce_command", {
      p_user_id: user, p_action: "create-shop", p_payload: { name: "Mes fleurs" }, p_request_key: user,
    });
  });
  it.each([
    { action: "create-shop", name: "x" }, { action: "rename-shop", name: "<script>" },
    { action: "advertise", kind: "constructor" }, { action: "shop-renewal", enabled: "true" },
    { action: "pay-lab", invoiceId: "bad-id" }, { action: "domiciliation", mode: "anything" },
    { action: "internet", enabled: true },
  ])("rejects invalid or obsolete request $action before calling a mutation", async input => {
    await expect(handleKqCommerceAction(user, { ...input, requestKey: user })).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { action: "advertise", kind: "radio" }, { action: "pay-lab", invoiceId: stockId },
    { action: "domiciliation", mode: "external" }, { action: "shop-renewal", enabled: false }, { action: "renew-shop" },
  ])("dispatches $action with the idempotency key", async ({ action, ...payload }) => {
    await handleKqCommerceAction(user, { action, ...payload, requestKey: user });
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_kq_commerce_command", { p_user_id: user, p_action: action, p_payload: payload, p_request_key: user });
  });
  it("fails closed against an old schema instead of selling with the old subscription", async () => {
    const data = snapshot(); delete data.business;
    mocks.rpc.mockResolvedValue({ data, error: null });
    await expect(getKqCommerceSnapshot(user)).rejects.toThrow("business_calendar_migration_required");
    await expect(handleKqCommerceAction(user, { action: "quote", stockId, channel: "online", policy: "advised" })).rejects.toThrow("business_calendar_migration_required");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("stores tax and debt deductions and expires the quote before the next business event", async () => {
    const data = snapshot();
    data.business!.lab.overdueCents = 4500;
    data.business!.nextEventAt = new Date(now + 60000).toISOString();
    mocks.rpc.mockResolvedValue({ data, error: null });
    const result = await handleKqCommerceAction(user, { action: "quote", stockId, channel: "cbd-shop", policy: "advised", vatCents: 0 });
    expect(result).toMatchObject({ vatCents: 1800, labPaidCents: 4500, electricityPaidCents: 0, netPayoutCents: 4500, expiresAt: data.business!.nextEventAt });
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ offer: expect.objectContaining({ vatCents: 1800, netPayoutCents: 4500 }) }));
  });
  it("does not persist an online offer for a player still saving for a site", async () => {
    const data = snapshot(); data.business = createKqBusinessPreview(now);
    mocks.rpc.mockResolvedValue({ data, error: null });
    const result = await handleKqCommerceAction(user, { action: "quote", stockId, channel: "online", policy: "advised" });
    expect(result.offer.units).toBe(0);
    expect(result.offer.reason).toContain("1 000 €");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
