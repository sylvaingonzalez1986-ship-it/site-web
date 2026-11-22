import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), enabled: vi.fn(), replace: vi.fn(), expand: vi.fn(), shop: vi.fn(), storage: vi.fn(), purchase: vi.fn(), tier: vi.fn(), upgrade: vi.fn(), rate: vi.fn() }));
vi.mock("@/lib/supabase/kanab-quest-storage-backend", () => ({ getKqStorageSnapshot: mocks.storage }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqGameRequestEnabled: mocks.enabled }));
vi.mock("@/lib/security-rate-limit", () => ({ getRequestIp: () => "127.0.0.1", hitRateLimit: mocks.rate, logRateLimitRejection: vi.fn() }));
vi.mock("@/lib/supabase/kanab-quest-equipment-backend", () => ({
  expandKqProduction: mocks.expand, replaceKqCultureEquipment: mocks.replace, getKqEquipmentShopSnapshot: mocks.shop, equipKqDurableEquipment: vi.fn(),
  purchaseKqDurableEquipment: mocks.purchase, setKqEquipmentRoutePlan: vi.fn(), upgradeKqDurableEquipment: mocks.upgrade, repairKqMachine: vi.fn(),
  purchaseKqWorkshopTier: mocks.tier,
}));
import { GET, POST, PATCH } from "./route";
const body = { action: "replace", equipmentCode: "LED-300", requestKey: "replacement-key", expectedVersion: 10, expectedCostCents: 35900 };
const request = (extra: Record<string, unknown> = {}) => new Request("http://localhost/api/arena/placard/equipment", { method: "PATCH", body: JSON.stringify({ ...body, ...extra }) });
describe("culture equipment replacement endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.enabled.mockResolvedValue(true);
    mocks.session.mockResolvedValue({ customerId: "session-owner", customer: { email: "owner@example.test" } });
    mocks.rate.mockResolvedValue({ allowed: true }); mocks.replace.mockResolvedValue({ paidCents: 35900, level: 1 });
  });
  it("requires feature access and authentication before replacing", async () => {
    mocks.enabled.mockResolvedValue(false); expect((await PATCH(request())).status).toBe(404);
    expect(mocks.session).not.toHaveBeenCalled();
    mocks.enabled.mockResolvedValue(true); mocks.session.mockResolvedValue(null);
    expect((await PATCH(request())).status).toBe(401); expect(mocks.replace).not.toHaveBeenCalled();
  });
  it("uses the authenticated owner and the confirmed price/version", async () => {
    expect((await PATCH(request({ userId: "another-player", tentNumber: 2 }))).status).toBe(200);
    expect(mocks.replace).toHaveBeenCalledWith({ userId: "session-owner", equipmentCode: "LED-300", requestKey: "replacement-key", expectedVersion: 10, expectedCostCents: 35900, tentNumber: 2 });
  });
  it("rate limits replacements before spending any cash", async () => {
    mocks.rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 12 });
    const response = await PATCH(request()); expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("12"); expect(mocks.replace).not.toHaveBeenCalled();
  });
  it("passes missing confirmations as invalid values", async () => {
    await PATCH(request({ expectedCostCents: undefined, expectedVersion: undefined }));
    expect(mocks.replace).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: -1, expectedCostCents: -1 }));
  });
  it("preserves gameplay errors while hiding database internals", async () => {
    mocks.replace.mockRejectedValueOnce(new Error("Termine la culture en cours avant de remplacer le matériel."));
    let response = await PATCH(request()); expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Termine la culture en cours avant de remplacer le matériel." });
    mocks.replace.mockRejectedValueOnce(new Error("[supabase:culture-equipment-replacement] private data"));
    response = await PATCH(request()); expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Service momentanément indisponible." });
  });
});


describe("direct workshop tier endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.enabled.mockResolvedValue(true);
    mocks.session.mockResolvedValue({ customerId: "session-owner", customer: { email: "owner@example.test" } });
    mocks.rate.mockResolvedValue({ allowed: true }); mocks.tier.mockResolvedValue({ level: 7, priceCents: 2_160_000 });
  });
  const buy = () => request({ action: "workshop-tier", userId: "forged-owner", equipmentCode: "PRESS-0600", targetLevel: 7, expectedLevel: 0, expectedPriceCents: 2_160_000 });
  it("uses the session owner and a single explicit tier action", async () => {
    expect((await PATCH(buy())).status).toBe(200);
    expect(mocks.tier).toHaveBeenCalledWith({ userId: "session-owner", requestKey: body.requestKey, equipmentCode: "PRESS-0600", targetLevel: 7, expectedLevel: 0, expectedPriceCents: 2_160_000 });
    expect(mocks.purchase).not.toHaveBeenCalled();
  });
  it("requires login, feature access and rate budget before purchasing", async () => {
    mocks.enabled.mockResolvedValue(false); expect((await PATCH(buy())).status).toBe(404);
    mocks.enabled.mockResolvedValue(true); mocks.session.mockResolvedValue(null); expect((await PATCH(buy())).status).toBe(401);
    mocks.session.mockResolvedValue({ customerId: "session-owner", customer: {} }); mocks.rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 15 });
    expect((await PATCH(buy())).status).toBe(429); expect(mocks.tier).not.toHaveBeenCalled();
  });
  it("passes omitted quote fields as invalid and hides RPC internals", async () => {
    await PATCH(request({ action: "workshop-tier" }));
    expect(mocks.tier).toHaveBeenCalledWith(expect.objectContaining({ targetLevel: 0, expectedLevel: -1, expectedPriceCents: -1 }));
    mocks.tier.mockRejectedValueOnce(new Error("[supabase:rpc_kq_purchase_workshop_tier] private details"));
    const response = await PATCH(buy()); expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Service momentanément indisponible." });
  });
  it("forwards the single-level workshop quote and exposes a stale price for reconfirmation", async () => {
    const upgrade = { action: "upgrade", equipmentCode: "WASHER-25L", expectedLevel: 3, tentNumber: 8 };
    mocks.upgrade.mockResolvedValueOnce({ level: 4, priceCents: 950_000 });
    const response = await PATCH(request({ ...upgrade, expectedPriceCents: 950_000 }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ level: 4, priceCents: 950_000 });
    expect(mocks.upgrade).toHaveBeenCalledWith({
      userId: "session-owner", requestKey: body.requestKey, equipmentCode: "WASHER-25L",
      expectedLevel: 3, expectedPriceCents: 950_000, expectedUnits: 1, tentNumber: 8,
    });
    const message = "Le prix de l’amélioration a changé. Recharge la fiche avant de confirmer.";
    mocks.upgrade.mockRejectedValueOnce(new Error(message));
    const stale = await PATCH(request({ ...upgrade, expectedPriceCents: 2_970 }));
    expect(stale.status).toBe(400);
    expect(await stale.json()).toEqual({ error: message });
    expect(mocks.upgrade).toHaveBeenLastCalledWith(expect.objectContaining({ expectedPriceCents: 2_970 }));
  });
});

describe("production expansion endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.enabled.mockResolvedValue(true);
    mocks.session.mockResolvedValue({customerId:"session-owner",customer:{email:"owner@example.test"}});
    mocks.rate.mockResolvedValue({allowed:true}); mocks.expand.mockResolvedValue({productionUnits:3});
  });
  const expandRequest=()=>request({action:"expand-production",userId:"forged-owner",expectedUnits:2,expectedCostCents:30000});
  it("uses the authenticated player and passes the quote through", async () => {
    const response=await PATCH(expandRequest()); expect(response.status).toBe(200);
    expect(mocks.expand).toHaveBeenCalledWith({userId:"session-owner",requestKey:body.requestKey,expectedUnits:2,expectedCostCents:30000});
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it("keeps access and rate guards ahead of expansion", async () => {
    mocks.enabled.mockResolvedValue(false); expect((await PATCH(expandRequest())).status).toBe(404);
    mocks.enabled.mockResolvedValue(true); mocks.session.mockResolvedValue(null); expect((await PATCH(expandRequest())).status).toBe(401);
    mocks.session.mockResolvedValue({customerId:"session-owner",customer:{}}); mocks.rate.mockResolvedValue({allowed:false,retryAfterSeconds:10});
    expect((await PATCH(expandRequest())).status).toBe(429); expect(mocks.expand).not.toHaveBeenCalled();
  });
  it("requires explicit quote fields and hides database details", async () => {
    await PATCH(request({action:"expand-production",expectedCostCents:undefined}));
    expect(mocks.expand).toHaveBeenCalledWith(expect.objectContaining({expectedUnits:-1,expectedCostCents:-1}));
    mocks.expand.mockRejectedValueOnce(new Error("[supabase:production-expansion] private details"));
    const response=await PATCH(expandRequest()); expect(response.status).toBe(500);
    expect(await response.json()).toEqual({error:"Service momentanément indisponible."});
  });
});

describe("individual tent equipment endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.enabled.mockResolvedValue(true);
    mocks.session.mockResolvedValue({ customerId: "session-owner", customer: { email: "owner@example.test" } });
    mocks.rate.mockResolvedValue({ allowed: true });
    mocks.shop.mockResolvedValue({ tentNumber: 2 });
    mocks.storage.mockResolvedValue({ capacity: { freeUnits: 1000, totalUnits: 2000 }, businessStartedAt: "2026-10-10T12:00:00Z", serverNow: "2026-10-10T16:00:00Z" });
    mocks.purchase.mockResolvedValue({ totalPriceCents: 35900 });
  });
  it("reads the selected tent for the authenticated owner", async () => {
    const response = await GET(new Request("http://localhost/api/arena/placard/equipment?tentNumber=2&userId=another-player"));
    expect(response.status).toBe(200);
    expect(mocks.shop).toHaveBeenCalledWith("session-owner", 2);
    expect(mocks.storage).toHaveBeenCalledWith("session-owner");
    expect(await response.json()).toMatchObject({ storageCapacity: { freeUnits: 1000, totalUnits: 2000 },
      businessClock: { startedAt: "2026-10-10T12:00:00Z", serverNow: "2026-10-10T16:00:00Z" } });
  });
  it("keeps equipment available with an explicit missing storage estimate", async () => {
    mocks.storage.mockRejectedValueOnce(new Error("storage unavailable"));
    const response = await GET(new Request("http://localhost/api/arena/placard/equipment"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ storageCapacity: null, businessClock: null });
  });
  it("forwards the confirmed total for a mixed workshop basket", async () => {
    const response = await POST(request({ equipmentCodes: ["LED-300", "WASHER-25L"], tentNumber: 2, expectedPriceCents: 665_900 }));
    expect(response.status).toBe(200);
    expect(mocks.purchase).toHaveBeenCalledWith(expect.objectContaining({ userId: "session-owner", tentNumber: 2, expectedPriceCents: 665_900 }));
  });
  it("passes the selected tent to a purchase without accepting a forged owner", async () => {
    const response = await POST(request({ equipmentCodes: ["LED-300"], userId: "forged", tentNumber: 2, expectedUnits: 4 }));
    expect(response.status).toBe(200);
    expect(mocks.purchase).toHaveBeenCalledWith({ userId: "session-owner", requestKey: body.requestKey, equipmentCodes: ["LED-300"], expectedUnits: 4, tentNumber: 2 });
  });
});
