import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/arena/placard/contracts/route";
import { KqContractError } from "@/lib/supabase/kanab-quest-contracts-backend";

const mocks = vi.hoisted(() => ({ enabled: vi.fn(), session: vi.fn(), rate: vi.fn(), log: vi.fn(), get: vi.fn(), change: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: mocks.enabled }));
vi.mock("@/lib/security-rate-limit", () => ({ getRequestIp: () => "127.0.0.1", hitRateLimit: mocks.rate, logRateLimitRejection: mocks.log }));
vi.mock("@/lib/supabase/kanab-quest-contracts-backend", async importOriginal => {
  const original = await importOriginal<typeof import("@/lib/supabase/kanab-quest-contracts-backend")>();
  return { ...original, getKqContract: mocks.get, changeKqContract: mocks.change };
});
const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const snapshot = { code: "light-hand", status: "accepted", runId: null, quality: null, cardsUsed: null, rewardCents: 3000, canAccept: false, reason: null };
const request = (body: string = '{"action":"accept","code":"light-hand"}') => new Request("http://localhost/api/arena/placard/contracts", { method: "POST", headers: { "content-type": "application/json" }, body });
beforeEach(() => {
  vi.clearAllMocks(); mocks.enabled.mockResolvedValue(true); mocks.session.mockResolvedValue({ customerId: user, customer: { email: "fixture@example.test" } });
  mocks.rate.mockResolvedValue({ allowed: true, retryAfterSeconds: 30 }); mocks.get.mockResolvedValue(snapshot); mocks.change.mockResolvedValue(snapshot);
});
describe("private production contract route", () => {
  it("returns an uncached snapshot and submits the authenticated identity only", async () => {
    const response = await GET(); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("private, no-store");
    expect(mocks.get).toHaveBeenCalledWith(user);
    expect((await POST(request())).status).toBe(200);
    expect(mocks.change).toHaveBeenCalledExactlyOnceWith(user, { action: "accept", code: "light-hand" });
  });
  it("honors the game gate and login before reading or changing contracts", async () => {
    mocks.enabled.mockResolvedValue(false);
    expect((await GET()).status).toBe(404); expect((await POST(request())).status).toBe(404);
    mocks.enabled.mockResolvedValue(true); mocks.session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401); expect((await POST(request())).status).toBe(401);
    expect(mocks.get).not.toHaveBeenCalled(); expect(mocks.change).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON and uses the standard rate limit", async () => {
    expect((await POST(request("{"))).status).toBe(400); expect(mocks.change).not.toHaveBeenCalled();
    mocks.rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 42 });
    const response = await POST(request()); expect(response.status).toBe(429); expect(response.headers.get("retry-after")).toBe("42");
    expect(mocks.log).toHaveBeenCalled(); expect(mocks.change).not.toHaveBeenCalled();
  });
  it("preserves a safe conflict but hides internal failures", async () => {
    mocks.change.mockRejectedValue(new KqContractError("Termine ta culture en cours.", 409));
    const conflict = await POST(request()); expect(conflict.status).toBe(409); expect(await conflict.json()).toEqual({ error: "Termine ta culture en cours." });
    mocks.get.mockRejectedValue(new Error("private SQL implementation"));
    const unavailable = await GET(); expect(unavailable.status).toBe(503); expect(JSON.stringify(await unavailable.json())).not.toContain("private SQL");
  });
});
