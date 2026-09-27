import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), get: vi.fn(), sync: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/security-rate-limit", () => ({ getRequestIp: () => "test", hitRateLimit: mocks.limit }));
vi.mock("@/lib/supabase/kanab-quest-order-cash-backend", () => ({
  getKqOrderCashRewards: mocks.get, syncKqOrderCashRewards: mocks.sync,
}));
import { GET, POST } from "./route";
const rewards = { available: true, gameEurosPerEuro: 10, startsAt: "2026-09-27T00:00:00Z", receipts: [] };
const request = () => new Request("http://localhost/api/account/order-cash-rewards", {
  method: "POST", body: JSON.stringify({ customerId: "victim", orderId: "forged", cashCents: 99999999 }),
});
describe("order game cash endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue({ customerId: "session-user" });
    mocks.limit.mockResolvedValue({ allowed: true });
    mocks.get.mockResolvedValue(rewards);
    mocks.sync.mockResolvedValue(rewards);
  });
  it("offers an anonymous read-only preview without private receipts", async () => {
    mocks.session.mockResolvedValue(null);
    const response = await GET();
    expect(await response.json()).toEqual({ rewards });
    expect(mocks.get).toHaveBeenCalledExactlyOnceWith(null);
    expect(mocks.sync).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toContain("private, no-store");
  });
  it("reads receipts solely for the authenticated session", async () => {
    expect((await GET()).status).toBe(200);
    expect(mocks.get).toHaveBeenCalledExactlyOnceWith("session-user");
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it("refuses unauthenticated reconciliation", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it("ignores forged IDs and amounts in a reconciliation request", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.sync).toHaveBeenCalledExactlyOnceWith("session-user");
  });
  it("rate limits reconciliation without calling its RPC", async () => {
    mocks.limit.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it.each(["read", "sync"])("hides infrastructure errors on %s", async operation => {
    mocks.get.mockRejectedValue(new Error("secret table"));
    mocks.sync.mockRejectedValue(new Error("secret table"));
    const response = operation === "read" ? await GET() : await POST(request());
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("secret table");
  });
});
