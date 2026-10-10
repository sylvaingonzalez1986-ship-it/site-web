import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), enabled: vi.fn(), shop: vi.fn(), purchase: vi.fn(), apply: vi.fn(), rate: vi.fn(), log: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: mocks.enabled }));
vi.mock("@/lib/security-rate-limit", () => ({ getRequestIp: () => "127.0.0.1", hitRateLimit: mocks.rate, logRateLimitRejection: mocks.log }));
vi.mock("@/lib/supabase/kanab-quest-care-backend", () => ({ getKqCareShopSnapshot: mocks.shop, purchaseKqCareProduct: mocks.purchase, applyKqPlayerCare: mocks.apply }));
import { GET, POST } from "./route";
import { POST as intervene } from "../runs/[runId]/care/route";
const request = (body: unknown) => new Request("http://localhost/api/arena/placard/care", { method: "POST", body: JSON.stringify(body) });
const context = { params: Promise.resolve({ runId: "requested-run" }) };
const purchase = { productCode: "CARE-SEAWEED", quantity: 2, requestKey: "request-key" };

describe("care inventory and interventions endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.enabled.mockResolvedValue(true);
    mocks.session.mockResolvedValue({ customerId: "session-owner", customer: { email: "owner@example.test" } });
    mocks.rate.mockResolvedValue({ allowed: true });
    mocks.shop.mockResolvedValue({ inventory: [], cashCents: 35000 });
    mocks.purchase.mockResolvedValue({ inventory: [], cashCents: 32000 });
    mocks.apply.mockResolvedValue({ state: { care: {} }, inventory: [] });
  });
  it("requires player access and authentication before reading or writing", async () => {
    mocks.enabled.mockResolvedValue(false);
    expect((await GET()).status).toBe(404);
    expect((await POST(request(purchase))).status).toBe(404);
    expect((await intervene(request(purchase), context)).status).toBe(404);
    expect(mocks.session).not.toHaveBeenCalled();
    mocks.enabled.mockResolvedValue(true); mocks.session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await POST(request(purchase))).status).toBe(401);
    expect((await intervene(request(purchase), context)).status).toBe(401);
    expect(mocks.purchase).not.toHaveBeenCalled(); expect(mocks.apply).not.toHaveBeenCalled();
  });
  it("always uses session identity and excludes browser prices and state", async () => {
    const res = await POST(request({ ...purchase, userId: "forged", priceCents: 0 }));
    expect(res.status).toBe(200);
    expect(mocks.purchase).toHaveBeenCalledWith({ ...purchase, userId: "session-owner" });
    await intervene(request({ productCode: "CARE-SEAWEED", requestKey: "request-key", state: { vitality: 999 }, userId: "forged", expectedUpdatedAt: "version" }), context);
    expect(mocks.apply).toHaveBeenCalledWith({ userId: "session-owner", runId: "requested-run", productCode: "CARE-SEAWEED", requestKey: "request-key", expectedUpdatedAt: "version" });
  });
  it("requires the displayed price before a paid basic care request reaches the backend", async () => {
    for (const basicPriceCents of [undefined, 0, -500, "500", 1.5]) {
      const response = await intervene(request({ action: "basic", requestKey: "request-key", basicPriceCents }), context);
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: expect.stringContaining("payant") });
    }
    expect(mocks.apply).not.toHaveBeenCalled();
    expect((await intervene(request({ action: "basic", requestKey: "request-key", basicPriceCents: 500 }), context)).status).toBe(200);
    expect(mocks.apply).toHaveBeenCalledWith({ userId: "session-owner", runId: "requested-run", action: "basic", requestKey: "request-key", basicPriceCents: 500 });
    expect((await intervene(request({ action: "basic", ...purchase }), context)).status).toBe(400);
  });
  it("rejects malformed payloads and quantities without coercing them", async () => {
    for (const body of [null, [], { ...purchase, quantity: "2" }, { ...purchase, requestKey: undefined }]) expect((await POST(request(body))).status).toBe(400);
    expect((await intervene(request({ action: "invented", requestKey: "key", productCode: "CARE-SEAWEED" }), context)).status).toBe(400);
    expect(mocks.purchase).not.toHaveBeenCalled(); expect(mocks.apply).not.toHaveBeenCalled();
  });
  it("rate limits and logs both mutation endpoints before using stock", async () => {
    mocks.rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 20 });
    expect((await POST(request(purchase))).status).toBe(429);
    const response = await intervene(request(purchase), context);
    expect(response.status).toBe(429); expect(response.headers.get("retry-after")).toBe("20");
    expect(mocks.log).toHaveBeenCalledTimes(2); expect(mocks.purchase).not.toHaveBeenCalled(); expect(mocks.apply).not.toHaveBeenCalled();
  });
  it("prevents shared caches and keeps private database errors private", async () => {
    expect((await GET()).headers.get("cache-control")).toContain("no-store");
    mocks.apply.mockRejectedValueOnce(new Error("[supabase:rpc] private data"));
    const response = await intervene(request(purchase), context);
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: "Service momentanément indisponible." });
  });
});
