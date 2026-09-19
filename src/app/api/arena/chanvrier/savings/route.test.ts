import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), enabled: vi.fn(), rate: vi.fn(), savings: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: mocks.enabled }));
vi.mock("@/lib/security-rate-limit", () => ({ hitRateLimit: mocks.rate }));
vi.mock("@/lib/supabase/chanvrier-savings-backend", async importOriginal => ({ ...await importOriginal<object>(), getChanvrierSavings: mocks.savings }));
import { ChanvrierSavingsError } from "@/lib/supabase/chanvrier-savings-backend";
import { GET, POST } from "./route";
const command = { action: "deposit", amountCents: 10000, requestKey: "d5ec9e72-3d9a-4b54-8e39-02b0053d0e79" };
const request = (body: unknown) => new Request("http://localhost/api/arena/chanvrier/savings", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); mocks.session.mockResolvedValue({ customerId: "player" }); mocks.enabled.mockResolvedValue(true); mocks.rate.mockResolvedValue({ allowed: true }); mocks.savings.mockResolvedValue({ balanceCents: 10000 }); });
describe("private savings API", () => {
  it("requires a session and an enabled arena", async () => {
    mocks.session.mockResolvedValue(null); expect((await GET()).status).toBe(401); expect((await POST(request(command))).status).toBe(401);
    mocks.session.mockResolvedValue({ customerId: "player" }); mocks.enabled.mockResolvedValue(false); expect((await GET()).status).toBe(404);
    expect(mocks.savings).not.toHaveBeenCalled();
  });
  it("uses server identity, validates money and strips forged balance and interest", async () => {
    const response = await POST(request({ ...command, userId: "victim", balanceCents: 10000000, ratePercent: 100 }));
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.savings).toHaveBeenCalledWith("player", command);
    mocks.savings.mockClear();
    expect((await POST(request({ ...command, amountCents: -100 }))).status).toBe(400);
    expect((await POST(new Request("http://localhost", { method: "POST", body: "{" }))).status).toBe(400);
    expect(mocks.savings).not.toHaveBeenCalled();
  });
  it("rate limits reads and writes", async () => {
    mocks.rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 15 });
    expect((await GET()).status).toBe(429); const response = await POST(request(command)); expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("15"); expect(mocks.savings).not.toHaveBeenCalled();
  });
  it("denies other specialties and hides database details", async () => {
    mocks.savings.mockRejectedValue(new ChanvrierSavingsError("Réservé au Trésorier.", 403)); expect((await GET()).status).toBe(403);
    mocks.savings.mockRejectedValue(new Error("private database details")); const response = await GET(); expect(response.status).toBe(503); expect(await response.text()).not.toContain("private database details");
  });
});
