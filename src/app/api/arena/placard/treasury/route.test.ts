import { beforeEach, describe, expect, it, vi } from "vitest";
const { enabled, session, snapshot, rate, log } = vi.hoisted(() => ({
  enabled: vi.fn(), session: vi.fn(), snapshot: vi.fn(), rate: vi.fn(), log: vi.fn(),
}));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: enabled }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: session }));
vi.mock("@/lib/security-rate-limit", () => ({ getRequestIp: () => "127.0.0.1", hitRateLimit: rate, logRateLimitRejection: log }));
vi.mock("@/lib/supabase/kanab-quest-treasury-backend", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/supabase/kanab-quest-treasury-backend")>(), getKqTreasurySnapshot: snapshot,
}));
import { GET } from "./route";
const request = (query = "") => new Request("http://localhost/api/arena/placard/treasury?" + query);
beforeEach(() => {
  vi.clearAllMocks(); enabled.mockResolvedValue(true);
  session.mockResolvedValue({ customerId: "owner", customer: { email: "owner@example.test" } });
  rate.mockResolvedValue({ allowed: true }); snapshot.mockResolvedValue({ version: 1 });
});
describe("treasury API", () => {
  it("hides the feature before accessing account data", async () => {
    enabled.mockResolvedValue(false);
    expect((await GET(request())).status).toBe(404);
    expect(session).not.toHaveBeenCalled(); expect(snapshot).not.toHaveBeenCalled();
  });
  it("requires authentication", async () => {
    session.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
    expect(snapshot).not.toHaveBeenCalled(); expect(rate).not.toHaveBeenCalled();
  });
  it("takes ownership from the session and prevents shared caching", async () => {
    const response = await GET(request("userId=victim&period=previous&offset=25"));
    expect(response.status).toBe(200);
    expect(snapshot).toHaveBeenCalledExactlyOnceWith("owner", { period: "previous", offset: 25, limit: 25 });
    expect(response.headers.get("Cache-Control")).toContain("private, no-store");
  });
  it("rejects invalid filters before accessing accounting", async () => {
    expect((await GET(request("period=constructor"))).status).toBe(400);
    expect(snapshot).not.toHaveBeenCalled(); expect(rate).not.toHaveBeenCalled();
  });
  it("rate limits expensive reports before the database call", async () => {
    rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 });
    const response = await GET(request());
    expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("30");
    expect(snapshot).not.toHaveBeenCalled(); expect(log).toHaveBeenCalledOnce();
  });
  it.each(["[supabase:treasury] private schema", "unexpected transport details"])("never exposes internal errors: %s", async message => {
    snapshot.mockRejectedValue(new Error(message));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "La trésorerie est momentanément indisponible. Réessaie dans un instant." });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});
