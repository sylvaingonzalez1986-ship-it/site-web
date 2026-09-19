import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), enabled: vi.fn(), rate: vi.fn(), read: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/arena-character-access", () => ({ isArenaCharacterRequestEnabled: mocks.enabled }));
vi.mock("@/lib/security-rate-limit", () => ({ hitRateLimit: mocks.rate }));
vi.mock("@/lib/supabase/arena-chanvrier-backend", () => ({ getChanvrierProfile: mocks.read, saveChanvrierProfile: mocks.save }));
import { GET, POST } from "./route";
beforeEach(() => { vi.resetAllMocks(); mocks.session.mockResolvedValue({ customerId: "player" }); mocks.enabled.mockResolvedValue(true); mocks.rate.mockResolvedValue({ allowed: true }); mocks.read.mockResolvedValue(null); mocks.save.mockResolvedValue({ created: true }); });
const request = (value: unknown) => new Request("http://localhost/api/arena/chanvrier", { method: "POST", body: JSON.stringify(value) });
describe("chanvrier API", () => {
  it("requires an authenticated account and enabled game", async () => {
    mocks.session.mockResolvedValue(null); expect((await GET()).status).toBe(401); expect((await POST(request({}))).status).toBe(401);
    mocks.session.mockResolvedValue({ customerId: "player" }); mocks.enabled.mockResolvedValue(false); expect((await GET()).status).toBe(404);
    expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled();
  });
  it("uses server identity and private responses", async () => {
    const response = await POST(request({ userId: "victim", strength: "merchant" }));
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.save).toHaveBeenCalledWith("player", { userId: "victim", strength: "merchant" });
  });
  it("limits writes before entering the backend", async () => {
    mocks.rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 });
    const response = await POST(request({})); expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("30"); expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON and hides database details", async () => {
    expect((await POST(new Request("http://localhost", { method: "POST", body: "{" }))).status).toBe(400);
    mocks.save.mockRejectedValue(new Error("[supabase:chanvrier] private detail"));
    const response = await POST(request({})); expect(response.status).toBe(503); expect(await response.text()).not.toContain("private detail");
  });
});
