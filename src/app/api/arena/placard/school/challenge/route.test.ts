import { beforeEach, describe, expect, it, vi } from "vitest";
const { session, enabled, check, rate, log } = vi.hoisted(() => ({ session: vi.fn(), enabled: vi.fn(), check: vi.fn(), rate: vi.fn(), log: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: session }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: enabled }));
vi.mock("@/lib/supabase/kanab-quest-school-challenge-backend", () => ({ getKqSchoolChallenge: check }));
vi.mock("@/lib/security-rate-limit", () => ({ getRequestIp: () => "127.0.0.1", hitRateLimit: rate, logRateLimitRejection: log }));
import { GET, POST } from "./route";
const owner = "12345678-1234-4123-8123-123456789abc";
const command = () => ({ action: "start", requestKey: owner });
const request = (value: unknown = command(), headers: Record<string, string> = {}) => new Request("http://localhost/api/arena/placard/school/challenge", { method: "POST", headers: { "Content-Type": "application/json", "X-Kq-School-Owner": owner, ...headers }, body: JSON.stringify(value) });
beforeEach(() => { vi.clearAllMocks(); enabled.mockResolvedValue(true); session.mockResolvedValue({ customerId: owner, customer: { email: "school@example.test" } }); rate.mockResolvedValue({ allowed: true }); check.mockResolvedValue({ ownerId: owner }); });
describe("retired solo challenge API", () => {
  it("returns the tournament destination instead of resuming a solo round", async () => {
    const response = await GET(new Request("http://localhost/api/arena/placard/school/challenge"));
    expect(response.status).toBe(410); expect(check).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toContain("private, no-store");
    expect(response.headers.get("Location")).toBe("/arene/placard?view=school&section=tournament");
    expect(await response.json()).toEqual({ error: "Le quiz solo a fermé. Rejoins le tournoi du chanvre.", code: "school_quiz_retired", redirectTo: "/arene/placard?view=school&section=tournament" });
  });
  it.each(["start", "answer", "next"])("retires %s without invoking the solo backend", async action => {
    const response = await POST(request({ ...command(), action })); expect(response.status).toBe(410);
    expect(response.headers.get("Cache-Control")).toContain("private, no-store");
    expect((await response.json()).code).toBe("school_quiz_retired");
    expect(check).not.toHaveBeenCalled();
  });
  it("retains feature availability and authentication guards for both methods", async () => {
    enabled.mockResolvedValue(false);
    expect((await GET(new Request("http://localhost/api/arena/placard/school/challenge"))).status).toBe(404);
    expect((await POST(request())).status).toBe(404);
    expect(session).not.toHaveBeenCalled();
    enabled.mockResolvedValue(true); session.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost/api/arena/placard/school/challenge"))).status).toBe(401);
    expect((await POST(request())).status).toBe(401);
    expect(check).not.toHaveBeenCalled(); expect(rate).not.toHaveBeenCalled();
  });
  it("rejects authentication, origin and owner changes before revealing a correction", async () => {
    session.mockResolvedValueOnce(null); expect((await POST(request())).status).toBe(401);
    expect((await POST(request(command(), { origin: "https://attacker.test" }))).status).toBe(403);
    const changed = await POST(request(command(), { "X-Kq-School-Owner": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }));
    expect(changed.status).toBe(409); expect((await changed.json()).code).toBe("school_owner_changed");
    expect(check).not.toHaveBeenCalled();
  });
  it("does not consume obsolete payloads or process injected scores", async () => {
    for (const value of [{ ...command(), score: 10 }, { action: "answer", requestKey: owner }, { ...command(), padding: "x".repeat(9000) }]) {
      const incoming = request(value);
      expect((await POST(incoming)).status).toBe(410);
      expect(incoming.bodyUsed).toBe(false);
    }
    expect(check).not.toHaveBeenCalled();
  });
  it("rate limits checks independently of the final payment limit", async () => {
    rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 3 });
    const response = await POST(request()); expect(response.status).toBe(429);
    expect(rate).toHaveBeenCalledExactlyOnceWith({ key: "kq_school_challenge:" + owner, windowSeconds: 60, maxHits: 120 });
    expect(response.headers.get("Retry-After")).toBe("3");
    expect(response.headers.has("Location")).toBe(false);
    expect(check).not.toHaveBeenCalled();
  });
});
