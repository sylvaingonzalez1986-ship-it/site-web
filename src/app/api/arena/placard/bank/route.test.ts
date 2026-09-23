import { beforeEach, describe, expect, it, vi } from "vitest";
const { enabled, session, bank, rate, log } = vi.hoisted(() => ({ enabled: vi.fn(), session: vi.fn(), bank: vi.fn(), rate: vi.fn(), log: vi.fn() }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: enabled }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: session }));
vi.mock("@/lib/security-rate-limit", () => ({ getRequestIp: () => "127.0.0.1", hitRateLimit: rate, logRateLimitRejection: log }));
vi.mock("@/lib/supabase/kanab-quest-bank-backend", async original => ({ ...await original<typeof import("@/lib/supabase/kanab-quest-bank-backend")>(), getKqBank: bank }));
import { GET, POST } from "./route";
const id = "12345678-1234-4123-8123-123456789abc";
const command = { action: "borrow", requestKey: id, quoteId: id, amountCents: 10000, expectedRateBps: 500 };
const getRequest = () => new Request("http://localhost/api/arena/placard/bank");
const request = (body: unknown = command, headers?: Record<string, string>) => new Request("http://localhost/api/arena/placard/bank", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks(); enabled.mockResolvedValue(true); session.mockResolvedValue({ customerId: "owner", customer: { email: "player@example.test" } });
  rate.mockResolvedValue({ allowed: true }); bank.mockResolvedValue({ version: 1 });
});
describe("bank API", () => {
  it("hides the feature and requires an authenticated player", async () => {
    enabled.mockResolvedValue(false); expect((await GET(getRequest())).status).toBe(404); expect(session).not.toHaveBeenCalled();
    enabled.mockResolvedValue(true); session.mockResolvedValue(null); expect((await POST(request())).status).toBe(401); expect(bank).not.toHaveBeenCalled();
    expect(rate).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled();
  });
  it("reads the account without a mutation command", async () => {
    const response = await GET(getRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ version: 1 });
    expect(bank).toHaveBeenCalledExactlyOnceWith("owner");
    expect(log).not.toHaveBeenCalled();
  });
  it("takes owner exclusively from the session and disables caching", async () => {
    const response = await POST(request({ ...command, userId: "victim" }));
    expect(response.status).toBe(200); expect(bank).toHaveBeenCalledExactlyOnceWith("owner", command);
    expect(response.headers.get("Cache-Control")).toContain("private, no-store");
    expect(log).not.toHaveBeenCalled();
  });
  it("blocks cross-site commands", async () => {
    expect((await POST(request(command, { origin: "https://attacker.test" }))).status).toBe(403);
    expect((await POST(request(command, { "sec-fetch-site": "cross-site" }))).status).toBe(403);
    expect(bank).not.toHaveBeenCalled();
  });
  it("bounds actual bodies even without content-length", async () => {
    expect((await POST(request({ ...command, padding: "x".repeat(3000) }))).status).toBe(413);
    expect(bank).not.toHaveBeenCalled();
  });
  it("rejects malformed contracts before invoking SQL", async () => {
    expect((await POST(request({ ...command, amountCents: 0 }))).status).toBe(400);
    expect(bank).not.toHaveBeenCalled();
  });
  it.each(["GET", "POST"])("rate limits and logs rejected %s account access", async (method) => {
    rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 31 });
    const response = method === "GET" ? await GET(getRequest()) : await POST(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("31");
    expect(response.headers.get("Cache-Control")).toContain("private, no-store");
    expect(bank).not.toHaveBeenCalled();
    expect(rate).toHaveBeenCalledExactlyOnceWith({ key: "kq_bank:owner", windowSeconds: 60, maxHits: 30 });
    expect(log).toHaveBeenCalledExactlyOnceWith({
      endpoint: `${method} /api/arena/placard/bank`,
      key: "kq_bank:owner",
      ip: "127.0.0.1",
      actorEmail: "player@example.test",
      retryAfterSeconds: 31,
      maxHits: 30,
      windowSeconds: 60,
    });
  });
  it("never exposes underlying database errors", async () => {
    bank.mockRejectedValue(new Error("private credentials"));
    const response = await GET(getRequest()); expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain("credentials");
  });
});
