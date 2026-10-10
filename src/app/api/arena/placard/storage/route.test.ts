import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ enabled: vi.fn(), session: vi.fn(), snapshot: vi.fn(), command: vi.fn(), rate: vi.fn(), log: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: mocks.enabled }));
vi.mock("@/lib/security-rate-limit", () => ({ getRequestIp: () => "127.0.0.1", hitRateLimit: mocks.rate, logRateLimitRejection: mocks.log }));
vi.mock("@/lib/supabase/kanab-quest-storage-backend", () => ({ getKqStorageSnapshot: mocks.snapshot, handleKqStorageAction: mocks.command }));
import { GET, POST } from "./route";
const request = (body: unknown) => new Request("http://localhost/api/arena/placard/storage", { method: "POST", body: JSON.stringify(body) });
describe("player storage route", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.enabled.mockResolvedValue(true);
    mocks.session.mockResolvedValue({ customerId: "session-owner", customer: { email: "owner@example.test" } });
    mocks.snapshot.mockResolvedValue({ lots: [] }); mocks.command.mockResolvedValue({ lots: [] }); mocks.rate.mockResolvedValue({ allowed: true });
  });
  it("requires access and an authenticated session", async () => {
    mocks.enabled.mockResolvedValue(false); expect((await GET()).status).toBe(404); expect((await POST(request({}))).status).toBe(404);
    expect(mocks.session).not.toHaveBeenCalled();
    mocks.enabled.mockResolvedValue(true); mocks.session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401); expect((await POST(request({}))).status).toBe(401);
    expect(mocks.command).not.toHaveBeenCalled();
  });
  it("uses the session owner for reads and mutations", async () => {
    expect((await GET()).status).toBe(200); expect(mocks.snapshot).toHaveBeenCalledWith("session-owner");
    await POST(request({ action: "buy", methodCode: "STORAGE-GROVE", userId: "forged" }));
    expect(mocks.command).toHaveBeenCalledWith("session-owner", expect.any(Object));
  });
  it("rejects malformed bodies and logs rate limiting before mutation", async () => {
    for (const body of [null, [], 3]) expect((await POST(request(body))).status).toBe(400);
    expect(mocks.command).not.toHaveBeenCalled();
    mocks.rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 20 });
    const response = await POST(request({}));
    expect(response.status).toBe(429); expect(response.headers.get("retry-after")).toBe("20");
    expect(mocks.log).toHaveBeenCalledTimes(1); expect(mocks.command).not.toHaveBeenCalled();
  });
  it("disables caches and masks private database errors", async () => {
    expect((await GET()).headers.get("cache-control")).toContain("no-store");
    mocks.command.mockRejectedValue(new Error("[supabase:storage] secret"));
    const response = await POST(request({}));
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: "Service momentanément indisponible." });
  });
});
