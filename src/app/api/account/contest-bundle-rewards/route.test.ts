import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const mocks = vi.hoisted(() => ({ session: vi.fn(), get: vi.fn(), sync: vi.fn(), rate: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/supabase/contest-bundle-rewards-backend", () => ({ getContestBundleRewards: mocks.get, syncContestBundleRewards: mocks.sync }));
vi.mock("@/lib/security-rate-limit", () => ({ getRequestIp: () => "127.0.0.1", hitRateLimit: mocks.rate }));
const request = (origin = "https://example.test") => new Request("https://example.test/api/account/contest-bundle-rewards", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ customerId: "other-user", orderId: "forged-order", minGrams: 0, packs: 999 }) });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ customerId: "session-user" });
  mocks.get.mockResolvedValue({ available: false, receipts: [] });
  mocks.sync.mockResolvedValue({ available: true, receipts: [] });
  mocks.rate.mockResolvedValue({ allowed: true });
});

describe("contest bundle account API", () => {
  it("provides only public configuration to guests and never syncs on GET", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET()).status).toBe(200);
    expect(mocks.get).toHaveBeenCalledWith(null);
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it("keeps reads private and scoped to the session", async () => {
    const response = await GET();
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.get).toHaveBeenCalledWith("session-user");
  });
  it("rejects unauthenticated and cross-origin mutations", async () => {
    mocks.session.mockResolvedValueOnce(null);
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request("https://attacker.test"))).status).toBe(403);
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it("ignores forged beneficiary, order and reward fields", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.sync).toHaveBeenCalledExactlyOnceWith("session-user");
  });
  it("rate limits sync before any grant", async () => {
    mocks.rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 12 });
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("12");
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it("keeps database failures private", async () => {
    mocks.sync.mockRejectedValue(new Error("private SQL and email"));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Bonus fleurs concours indisponible." });
  });
});
