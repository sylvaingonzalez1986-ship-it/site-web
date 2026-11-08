import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), enabled: vi.fn(), get: vi.fn(), action: vi.fn(), rate: vi.fn(), log: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: mocks.enabled }));
vi.mock("@/lib/security-rate-limit", () => ({ getRequestIp: () => "127.0.0.1", hitRateLimit: mocks.rate, logRateLimitRejection: mocks.log }));
vi.mock("@/lib/supabase/kanab-quest-staff-backend", () => ({ getKqStaffSnapshot: mocks.get, handleKqStaffAction: mocks.action }));
import { GET, POST } from "./route";
const request = (body: unknown) => new Request("http://localhost/api/arena/placard/staff", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks(); mocks.enabled.mockResolvedValue(true);
  mocks.session.mockResolvedValue({ customerId: "session-owner", customer: { email: "owner@example.test" } });
  mocks.rate.mockResolvedValue({ allowed: true }); mocks.get.mockResolvedValue({ revision: 1 }); mocks.action.mockResolvedValue({ revision: 2 });
});
describe("staff authentication and writes", () => {
  it("checks feature access then session before any operation", async () => {
    mocks.enabled.mockResolvedValue(false); expect((await GET()).status).toBe(404); expect((await POST(request({}))).status).toBe(404);
    expect(mocks.session).not.toHaveBeenCalled(); mocks.enabled.mockResolvedValue(true); mocks.session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401); expect((await POST(request({}))).status).toBe(401);
    expect(mocks.get).not.toHaveBeenCalled(); expect(mocks.action).not.toHaveBeenCalled();
  });
  it("binds all actions to the session and prevents cache reuse", async () => {
    const body = { action: "hire", userId: "forged" };
    const result = await POST(request(body)); expect(result.status).toBe(200);
    expect(mocks.action).toHaveBeenCalledExactlyOnceWith("session-owner", body);
    expect(result.headers.get("cache-control")).toContain("no-store"); expect((await GET()).headers.get("cache-control")).toContain("private");
  });
  it("limits writes before mutation and rejects invalid JSON", async () => {
    mocks.rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 17 });
    const limited = await POST(request({})); expect(limited.status).toBe(429); expect(limited.headers.get("retry-after")).toBe("17"); expect(mocks.log).toHaveBeenCalledOnce();
    mocks.rate.mockResolvedValue({ allowed: true });
    expect((await POST(new Request("http://localhost", { method: "POST", body: "invalid" }))).status).toBe(400);
    expect(mocks.action).not.toHaveBeenCalled();
  });
  it("does not expose database details and preserves business errors", async () => {
    mocks.get.mockRejectedValue(new Error("[supabase:staff] private database detail"));
    const read = await GET(); expect(read.status).toBe(503); expect(JSON.stringify(await read.json())).not.toContain("private database detail");
    mocks.action.mockRejectedValue(new Error("Repos le samedi et le dimanche."));
    const write = await POST(request({})); expect(write.status).toBe(400); expect(await write.json()).toEqual({ error: "Repos le samedi et le dimanche." });
  });
});
