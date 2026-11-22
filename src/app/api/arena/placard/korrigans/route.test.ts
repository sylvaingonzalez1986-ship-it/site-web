import { beforeEach, describe, expect, it, vi } from "vitest";
const { session, enabled, rpc, shop } = vi.hoisted(() => ({ session: vi.fn(), enabled: vi.fn(), rpc: vi.fn(), shop: vi.fn() }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqGameRequestEnabled: enabled }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: session }));
vi.mock("@/lib/security-rate-limit", () => ({ getRequestIp: () => "127.0.0.1", hitRateLimit: async () => ({ allowed: true }) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => ({ rpc }) }));
vi.mock("@/lib/supabase/kanab-quest-commerce-backend", () => ({ quoteKqKorriganShopValue: shop }));
import { GET, POST } from "./route";
const endpoint = "http://localhost/api/arena/placard/korrigans";
const lotId = "ae038c11-12df-42f6-8411-e4b9c986bc22";
const requestId = "d96ae02c-38ee-4b51-b40c-44dded816a10";
const post = (body: unknown) => POST(new Request(endpoint, { method: "POST", body: JSON.stringify(body) }));
beforeEach(() => {
  vi.resetAllMocks();
  enabled.mockResolvedValue(true);
  session.mockResolvedValue({ customerId: "player" });
  rpc.mockResolvedValue({ data: { session: null }, error: null });
});
describe("korrigan market", () => {
  it("requires a player session and suppresses shared caches", async () => {
    session.mockResolvedValue(null);
    const response = await GET(new Request(endpoint));
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("reconciles both prices on a quote", async () => {
    shop.mockResolvedValue(10500);
    rpc.mockResolvedValue({ data: { quote: { valueCents: 10500 } } });
    const body = { action: "quote", lotId, grams: 35 };
    expect((await post(body)).status).toBe(200);
    expect(shop).toHaveBeenCalledWith("player", lotId, 35);
    shop.mockResolvedValue(10499);
    expect((await post(body)).status).toBe(409);
  });
  it("sends the authenticated identity and game clock for an offer replay", async () => {
    const body = { action: "offer", lotId, grams: 37, expectedValueCents: 11100, requestId };
    expect((await post({ ...body, p_user_id: "other", p_clock: { night: 0 }, outcome: "x50" })).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("kq_korrigan_market", expect.objectContaining({
      p_user_id: "player", p_clock: { dayMs: 14400000, dawn: 300, night: 1260 }, p_request_id: requestId, p_expected_value_cents: 11100,
    }));
    expect(shop).not.toHaveBeenCalled();
  });
  it.each([{ action: "draw", sessionId: lotId, draw: 4 }, { action: "offer", grams: 0, lotId, requestId },
    { action: "offer", grams: 40, lotId, requestId }, { action: "quote", grams: 1.7, lotId }])("rejects invalid %j", async body => {
    expect((await post(body)).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("returns a recoverable conflict and keeps internal errors private", async () => {
    rpc.mockResolvedValue({ error: { message: "korrigan_closed" } });
    expect((await post({ action: "draw", sessionId: lotId, draw: 2 })).status).toBe(409);
    rpc.mockResolvedValue({ error: { message: "private-db-detail" } });
    const response = await GET(new Request(endpoint));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private-db-detail");
  });
});
