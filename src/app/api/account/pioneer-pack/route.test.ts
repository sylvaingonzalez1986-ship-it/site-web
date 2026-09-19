import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), rpc: vi.fn(), rate: vi.fn(), logRejection: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/audit-log", () => ({ logAuditEvent: mocks.audit }));
vi.mock("@/lib/security-rate-limit", () => ({ getRequestIp: () => "127.0.0.1", hitRateLimit: mocks.rate, logRateLimitRejection: mocks.logRejection }));
import { GET, POST } from "./route";
const request = () => new Request("http://localhost/api/account/pioneer-pack", { method: "POST", body: JSON.stringify({ userId: "victim", cashCents: 99999999, goldCard: "chosen", eligible: true }) });
const state = { eligible: true, claimed: false, available: true, cashCents: 100000, packCount: 10, grantedAt: null, goldCard: null };
describe("Pioneer pack API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue({ customerId: "signed-in-user", customer: { email: "player@example.test" } });
    mocks.rate.mockResolvedValue({ allowed: true });
    mocks.rpc.mockResolvedValue({ data: state, error: null });
  });
  it("reads only the authenticated player's status without caching or granting", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_pioneer_pack_state", { p_user_id: "signed-in-user" });
  });
  it("ignores forged identity, amount, eligibility and chosen Buddie", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...state, claimed: true, replayed: false }, error: null });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).cashCents).toBe(100000);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_kq_claim_pioneer_pack", { p_user_id: "signed-in-user" });
    expect(mocks.audit).toHaveBeenCalledOnce();
  });
  it("allows a replay to recover the original result", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...state, claimed: true, replayed: true, goldCard: { code: "HH2026-051", name: "Original draw", imageUrl: null } }, error: null });
    expect((await (await POST(request())).json()).replayed).toBe(true);
  });
  it("blocks unauthenticated requests before accessing rewards", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("requires authoritative order eligibility", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "pioneer_not_eligible" } });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("hides database details and handles unavailable or malformed snapshots", async () => {
    for (const result of [{ error: { message: "secret database details" } }, { data: null }, { data: {} }]) {
      mocks.rpc.mockResolvedValue(result);
      const response = await GET();
      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain("secret database");
    }
  });
  it("limits retries per account without touching the database", async () => {
    mocks.rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 42 });
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.rate).toHaveBeenCalledWith({ key: "pioneer_pack:signed-in-user", windowSeconds: 60, maxHits: 5 });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
