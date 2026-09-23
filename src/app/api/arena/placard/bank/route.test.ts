import { beforeEach, describe, expect, it, vi } from "vitest";
const { enabled, session, bank, rate } = vi.hoisted(() => ({ enabled: vi.fn(), session: vi.fn(), bank: vi.fn(), rate: vi.fn() }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: enabled }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: session }));
vi.mock("@/lib/security-rate-limit", () => ({ hitRateLimit: rate }));
vi.mock("@/lib/supabase/kanab-quest-bank-backend", async original => ({ ...await original<typeof import("@/lib/supabase/kanab-quest-bank-backend")>(), getKqBank: bank }));
import { GET, POST } from "./route";
const id = "12345678-1234-4123-8123-123456789abc";
const command = { action: "borrow", requestKey: id, quoteId: id, amountCents: 10000, expectedRateBps: 500 };
const request = (body: unknown = command, headers?: Record<string, string>) => new Request("http://localhost/api/arena/placard/bank", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks(); enabled.mockResolvedValue(true); session.mockResolvedValue({ customerId: "owner" });
  rate.mockResolvedValue({ allowed: true }); bank.mockResolvedValue({ version: 1 });
});
describe("bank API", () => {
  it("hides the feature and requires an authenticated player", async () => {
    enabled.mockResolvedValue(false); expect((await GET()).status).toBe(404); expect(session).not.toHaveBeenCalled();
    enabled.mockResolvedValue(true); session.mockResolvedValue(null); expect((await POST(request())).status).toBe(401); expect(bank).not.toHaveBeenCalled();
  });
  it("takes owner exclusively from the session and disables caching", async () => {
    const response = await POST(request({ ...command, userId: "victim" }));
    expect(response.status).toBe(200); expect(bank).toHaveBeenCalledExactlyOnceWith("owner", command);
    expect(response.headers.get("Cache-Control")).toContain("private, no-store");
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
  it("rate limits all account access", async () => {
    rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 31 });
    const response = await GET(); expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("31"); expect(bank).not.toHaveBeenCalled();
  });
  it("never exposes underlying database errors", async () => {
    bank.mockRejectedValue(new Error("private credentials"));
    const response = await GET(); expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain("credentials");
  });
});
