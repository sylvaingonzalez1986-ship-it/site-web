import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ARENA_OPENING_AT } from "@/lib/arena-opening";
const mocks = vi.hoisted(() => ({ session: vi.fn(), beta: vi.fn(), publicEnabled: vi.fn(), get: vi.fn(), action: vi.fn(), rate: vi.fn(), log: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/kanab-quest-player-access", () => ({ isKqGameOpen: mocks.publicEnabled }));
vi.mock("@/lib/supabase/customer-backend", () => ({ loadContestBetaTesterEnabled: mocks.beta }));
vi.mock("@/lib/security-rate-limit", () => ({ getRequestIp: () => "127.0.0.1", hitRateLimit: mocks.rate, logRateLimitRejection: mocks.log }));
vi.mock("@/lib/supabase/kanab-quest-staff-backend", () => ({ getKqStaffSnapshot: mocks.get, handleKqStaffAction: mocks.action }));
import { GET, POST } from "./route";
const request = (body: unknown) => new Request("http://localhost/api/arena/placard/staff", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks(); mocks.beta.mockResolvedValue(true); mocks.publicEnabled.mockReturnValue(false);
  vi.spyOn(Date, "now").mockReturnValue(Date.parse(ARENA_OPENING_AT) + 1);
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("CONTEST_FEATURE_ENABLED", "true");
  vi.stubEnv("CONTEST_FEATURE_ALLOW_PRODUCTION", "true");
  vi.stubEnv("ADMIN_ALLOWED_EMAILS", "admin@example.test");
  mocks.session.mockResolvedValue({ customerId: "session-owner", customer: { email: "owner@example.test" } });
  mocks.rate.mockResolvedValue({ allowed: true }); mocks.get.mockResolvedValue({ revision: 1 }); mocks.action.mockResolvedValue({ revision: 2 });
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe("staff authentication and writes", () => {
  it.each(["CONTEST_FEATURE_ENABLED", "CONTEST_FEATURE_ALLOW_PRODUCTION"])("keeps the disabled feature hidden before identity lookup (%s)", flag => {
    vi.stubEnv(flag, "false");
    return Promise.all([GET(), POST(request({}))]).then(responses => {
      expect(responses.map(response => response.status)).toEqual([404, 404]);
      expect(mocks.session).not.toHaveBeenCalled(); expect(mocks.beta).not.toHaveBeenCalled();
      expect(mocks.get).not.toHaveBeenCalled(); expect(mocks.action).not.toHaveBeenCalled(); expect(mocks.rate).not.toHaveBeenCalled();
    });
  });
  it.each([true, false])("returns 401 for an expired private-preview session, before opening: %s", async prelaunch => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse(ARENA_OPENING_AT) + (prelaunch ? -1 : 1));
    mocks.session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401); expect((await POST(request({}))).status).toBe(401);
    expect(mocks.session).toHaveBeenNthCalledWith(1, "identity"); expect(mocks.session).toHaveBeenNthCalledWith(2, "identity");
    expect(mocks.beta).not.toHaveBeenCalled(); expect(mocks.get).not.toHaveBeenCalled(); expect(mocks.action).not.toHaveBeenCalled(); expect(mocks.rate).not.toHaveBeenCalled();
  });
  it("denies an authenticated non-beta player using the real identity access helper", async () => {
    mocks.beta.mockResolvedValue(false);
    mocks.session.mockResolvedValue({ customerId: "ordinary-player", customer: { email: "ordinary@example.test", contestBetaEnabled: true } });
    expect((await GET()).status).toBe(404); expect((await POST(request({}))).status).toBe(404);
    expect(mocks.beta).toHaveBeenNthCalledWith(1, "ordinary-player"); expect(mocks.beta).toHaveBeenNthCalledWith(2, "ordinary-player");
    expect(mocks.get).not.toHaveBeenCalled(); expect(mocks.action).not.toHaveBeenCalled(); expect(mocks.rate).not.toHaveBeenCalled();
  });
  it("allows an approved public game after opening without private beta access", async () => {
    mocks.publicEnabled.mockReturnValue(true); mocks.beta.mockResolvedValue(false);
    vi.stubEnv("CONTEST_FEATURE_ENABLED", "false");
    expect((await GET()).status).toBe(200); expect((await POST(request({}))).status).toBe(200);
    expect(mocks.beta).not.toHaveBeenCalled();
    mocks.session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401); expect((await POST(request({}))).status).toBe(401);
  });
  it("does not let the public enable flag bypass prelaunch private access", async () => {
    mocks.publicEnabled.mockReturnValue(true); mocks.beta.mockResolvedValue(false);
    vi.spyOn(Date, "now").mockReturnValue(Date.parse(ARENA_OPENING_AT) - 1);
    expect((await GET()).status).toBe(404); expect((await POST(request({}))).status).toBe(404);
    expect(mocks.get).not.toHaveBeenCalled(); expect(mocks.action).not.toHaveBeenCalled();
    vi.stubEnv("CONTEST_FEATURE_ENABLED", "false"); mocks.session.mockClear();
    expect((await GET()).status).toBe(404); expect((await POST(request({}))).status).toBe(404);
    expect(mocks.session).not.toHaveBeenCalled();
  });
  it("binds all actions to the session and prevents cache reuse", async () => {
    const body = { action: "hire", userId: "forged" };
    const result = await POST(request(body)); expect(result.status).toBe(200);
    expect(mocks.action).toHaveBeenCalledExactlyOnceWith("session-owner", body);
    expect(result.headers.get("cache-control")).toContain("no-store"); expect((await GET()).headers.get("cache-control")).toContain("private");
  });
  it("rejects a persisted confirmation after another tab changes the signed-in account", async () => {
    const expectedOwnerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    mocks.session.mockResolvedValue({ customerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", customer: { email: "other@example.test" } });
    const result = await POST(request({ action: "hire", expectedOwnerId, requestKey: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }));
    expect(result.status).toBe(409);
    expect(await result.json()).toMatchObject({ code: "staff_owner_changed", error: expect.any(String) });
    expect(result.headers.get("cache-control")).toContain("no-store");
    expect(mocks.action).not.toHaveBeenCalled();
  });
  it("checks the expected owner while keeping the actual session as the action owner", async () => {
    const customerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    mocks.session.mockResolvedValue({ customerId, customer: { email: "owner@example.test" } });
    const body = { action: "hire", expectedOwnerId: customerId.toUpperCase(), userId: "forged" };
    expect((await POST(request(body))).status).toBe(200);
    expect(mocks.action).toHaveBeenCalledExactlyOnceWith(customerId, body);
  });
  it.each([null, "", "not-an-owner", 123, {}, []])("rejects malformed expected owner %j before mutation", async expectedOwnerId => {
    const result = await POST(request({ action: "hire", expectedOwnerId }));
    expect(result.status).toBe(400);
    expect(await result.json()).toEqual({ error: "Propriétaire de confirmation invalide." });
    expect(mocks.action).not.toHaveBeenCalled();
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
