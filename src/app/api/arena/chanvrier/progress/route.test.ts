import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), enabled: vi.fn(), rate: vi.fn(), read: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: mocks.enabled }));
vi.mock("@/lib/security-rate-limit", () => ({ hitRateLimit: mocks.rate }));
vi.mock("@/lib/supabase/chanvrier-progress-backend", () => ({ getChanvrierProgress: mocks.read, saveChanvrierShowcase: mocks.save }));
import { GET, PATCH } from "./route";
beforeEach(() => { vi.resetAllMocks(); mocks.session.mockResolvedValue({ customerId: "player" }); mocks.enabled.mockResolvedValue(true); mocks.rate.mockResolvedValue({ allowed: true }); mocks.read.mockResolvedValue({ metrics: {} }); });
const request = (value: unknown) => new Request("http://localhost/api/arena/chanvrier/progress", { method: "PATCH", body: JSON.stringify(value) });
const showcase = { badges: ["kq-ach-triple-spark-1"], title: null, tracked: "triple-spark" };
describe("private chanvrier progression", () => {
  it("requires session and enabled game before any data access", async () => {
    mocks.session.mockResolvedValue(null); expect((await GET()).status).toBe(401); expect((await PATCH(request({ showcase }))).status).toBe(401);
    mocks.session.mockResolvedValue({ customerId: "player" }); mocks.enabled.mockResolvedValue(false); expect((await GET()).status).toBe(404);
    expect(mocks.read).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
  });
  it("reads privately and scopes writes to the server identity", async () => {
    const response = await GET(); expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.read).toHaveBeenCalledWith("player");
    expect((await PATCH(request({ userId: "victim", showcase }))).status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith("player", showcase, null);
  });
  it("never accepts client progress, duplicates or more than three badges", async () => {
    for (const body of [{ metrics: { "triple-spark": 999 } }, { showcase: { ...showcase, badges: ["a", "a"] } }, { showcase: { ...showcase, badges: ["a", "b", "c", "d"] } }, { showcase: { ...showcase, title: "made-up-title" } }, { seenBadgeCount: -1 }]) expect((await PATCH(request(body))).status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("acknowledges only the displayed badge count without changing the showcase", async () => {
    expect((await PATCH(request({ seenBadgeCount: 2 }))).status).toBe(200); expect(mocks.save).toHaveBeenCalledWith("player", null, 2);
  });
  it("handles rate limits before backend calls", async () => {
    mocks.rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 17 });
    const response = await PATCH(request({ showcase })); expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("17"); expect(mocks.save).not.toHaveBeenCalled();
  });
  it("rejects unearned awards and keeps infrastructure failures private", async () => {
    mocks.save.mockRejectedValue(new Error("showcase_not_owned")); expect((await PATCH(request({ showcase }))).status).toBe(403);
    mocks.read.mockRejectedValue(new Error("private database details")); const response = await GET(); expect(response.status).toBe(503); expect(await response.text()).not.toContain("database details");
    expect((await PATCH(new Request("http://localhost", { method: "PATCH", body: "{" }))).status).toBe(400);
  });
});
