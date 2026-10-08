import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), enabled: vi.fn(), summary: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerIdentityEnabled: mocks.enabled }));
vi.mock("@/lib/supabase/arena-player-summary", () => ({ getArenaPlayerSummary: mocks.summary }));
import { GET } from "./route";
const summary = { activeRun: true, readyLotCount: 1, availableFlowerCount: 0, supportPackCount: 2, buddiePackCount: 3 };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.enabled.mockResolvedValue(true);
  mocks.session.mockResolvedValue({ customerId: "current-player", customer: { email: "player@example.test" } });
  mocks.summary.mockResolvedValue(summary);
});
describe("GET /api/arena/placard/summary", () => {
  it("keeps existing activity access restrictions", async () => {
    mocks.enabled.mockResolvedValue(false);
    expect((await GET()).status).toBe(404);
    expect(mocks.summary).not.toHaveBeenCalled();
  });
  it("never reads player data for a guest", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(mocks.summary).not.toHaveBeenCalled();
  });
  it("uses the server identity and forbids shared caching", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(summary);
    expect(mocks.summary).toHaveBeenCalledExactlyOnceWith("current-player");
    expect(mocks.session).toHaveBeenCalledExactlyOnceWith("identity");
    expect(mocks.enabled).toHaveBeenCalledWith({ customerId: "current-player", customer: { email: "player@example.test" } });
    expect(response.headers.get("cache-control")).toContain("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
  });
  it("returns a retryable error without internal database details", async () => {
    mocks.summary.mockRejectedValue(new Error("private table details"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private table details");
  });
});
