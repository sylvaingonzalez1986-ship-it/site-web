import { beforeEach, describe, expect, it, vi } from "vitest";
const { enabled, session, history, rate, log } = vi.hoisted(() => ({
  enabled: vi.fn(), session: vi.fn(), history: vi.fn(), rate: vi.fn(), log: vi.fn(),
}));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: enabled }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: session }));
vi.mock("@/lib/security-rate-limit", () => ({ getRequestIp: () => "127.0.0.1", hitRateLimit: rate, logRateLimitRejection: log }));
vi.mock("@/lib/supabase/kanab-quest-online-sales-backend", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/supabase/kanab-quest-online-sales-backend")>(), getKqOnlineSalesHistory: history,
}));
import { GET } from "./route";
const request = (query = "") => new Request("http://localhost/api/arena/placard/commerce/sales?" + query);
beforeEach(() => {
  vi.clearAllMocks(); enabled.mockResolvedValue(true);
  session.mockResolvedValue({ customerId: "owner", customer: { email: "owner@example.test" } });
  rate.mockResolvedValue({ allowed: true }); history.mockResolvedValue({ receipts: [], nextCursor: null });
});

describe("online sales journal API", () => {
  it("checks feature access before looking up a session", async () => {
    enabled.mockResolvedValue(false);
    expect((await GET(request())).status).toBe(404);
    expect(session).not.toHaveBeenCalled(); expect(history).not.toHaveBeenCalled();
  });
  it("requires an authenticated player", async () => {
    session.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
    expect(history).not.toHaveBeenCalled(); expect(rate).not.toHaveBeenCalled();
  });
  it("reads only the session owner and prevents shared or browser caching", async () => {
    const response = await GET(request("userId=other-player&limit=25"));
    expect(response.status).toBe(200);
    expect(history).toHaveBeenCalledExactlyOnceWith("owner", { limit: 25, cursor: null });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store, max-age=0");
    expect(await response.json()).toEqual({ receipts: [], nextCursor: null });
  });
  it("rejects malformed cursors and page sizes before querying history", async () => {
    for (const query of ["cursor=bad-token", "limit=101", "limit=0"]) expect((await GET(request(query))).status).toBe(400);
    expect(history).not.toHaveBeenCalled(); expect(rate).not.toHaveBeenCalled();
  });
  it("throttles repeated history reads before querying receipts", async () => {
    rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 12 });
    const response = await GET(request());
    expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("12");
    expect(history).not.toHaveBeenCalled(); expect(log).toHaveBeenCalledOnce();
  });
  it.each(["[supabase:online-sales] missing migration", "unexpected transport detail"])("hides internal failures: %s", async message => {
    history.mockRejectedValue(new Error(message));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Le journal des ventes est momentanément indisponible. Réessaie dans un instant." });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});
