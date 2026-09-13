import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ enabled: vi.fn(), session: vi.fn(), rpc: vi.fn(), rate: vi.fn() }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: mocks.enabled }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/security-rate-limit", () => ({ hitRateLimit: mocks.rate }));
import { GET, POST } from "./route";
const request = (body: unknown) => new Request("http://localhost/api/arena/placard/missions", { method: "POST", body: JSON.stringify(body) });
describe("Placard mission API", () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.enabled.mockResolvedValue(true);
    mocks.session.mockResolvedValue({ customerId: "signed-in-user" });
    mocks.rate.mockResolvedValue({ allowed: true });
    mocks.rpc.mockResolvedValue({ data: { collectionActive: true, missions: [] }, error: null });
  });
  it("loads only the authenticated player's private progress", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_kq_mission_state", { p_user_id: "signed-in-user" });
  });
  it("ignores forged player identity, progress and rewards", async () => {
    expect((await POST(request({ code: "online-two", userId: "victim", progress: 100, cardCount: 100 }))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("rpc_kq_claim_mission", { p_user_id: "signed-in-user", p_code: "online-two" });
  });
  it("rejects signed-out and disabled access before reaching the database", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await POST(request({ code: "online-two" }))).status).toBe(401);
    mocks.enabled.mockResolvedValue(false);
    expect((await GET()).status).toBe(404);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects unknown codes and malformed bodies", async () => {
    for (const body of [null, [], {}, { code: "__proto__" }, { code: "invented" }]) expect((await POST(request(body))).status).toBe(400);
    expect((await POST(new Request("http://localhost", { method: "POST", body: "{" }))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("returns a conflict when current progress does not qualify", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "mission_not_ready" } });
    expect((await POST(request({ code: "online-two" }))).status).toBe(409);
  });
  it("hides database details and preserves an explicit unavailable status", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "private SQL credentials" } });
    const response = await GET();
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("private SQL");
  });
  it("limits claims per account", async () => {
    mocks.rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 42 });
    const response = await POST(request({ code: "online-two" }));
    expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("42");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
