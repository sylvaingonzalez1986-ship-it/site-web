import { beforeEach, describe, expect, it, vi } from "vitest";
const { session, enabled, health, rate, log } = vi.hoisted(() => ({ session: vi.fn(), enabled: vi.fn(), health: vi.fn(), rate: vi.fn(), log: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: session }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqGameRequestEnabled: enabled }));
vi.mock("@/lib/supabase/kanab-quest-school-health-backend", () => ({ getKqSchoolHealth: health }));
vi.mock("@/lib/security-rate-limit", () => ({ getRequestIp: () => "127.0.0.1", hitRateLimit: rate, logRateLimitRejection: log }));
import { GET, POST } from "./route";
const owner = "12345678-1234-4123-8123-123456789abc";
const command = () => ({ lessonIds: ["health-observation-1"], checkpointIds: [], activityIds: [], resumeLessonId: "health-observation-2", expectedRevision: 0 });
const request = (value: unknown = command(), headers?: Record<string, string>) => new Request("http://localhost/api/arena/placard/school/health", {
  method: "POST", headers: { "Content-Type": "application/json", "X-Kq-School-Owner": owner, ...headers }, body: JSON.stringify(value) });
beforeEach(() => {
  vi.clearAllMocks(); enabled.mockResolvedValue(true); session.mockResolvedValue({ customerId: owner, customer: { email: "school@example.test" } });
  rate.mockResolvedValue({ allowed: true }); health.mockResolvedValue({ version: 1, ownerId: owner });
});
describe("health progress API", () => {
  it("reads only the authenticated owner's learning record with private caching", async () => {
    const response = await GET(new Request("http://localhost/api/arena/placard/school/health"));
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toContain("private, no-store");
    expect(health).toHaveBeenCalledExactlyOnceWith(owner);
  });
  it("saves one batch and trusts no requested owner, amount or free text", async () => {
    expect((await POST(request())).status).toBe(200); expect(health).toHaveBeenCalledExactlyOnceWith(owner, command());
    for (const extra of [{ ownerId: "other" }, { gainCents: 100 }, { text: "learning reflection" }]) expect((await POST(request({ ...command(), ...extra }))).status).toBe(400);
    expect(health).toHaveBeenCalledTimes(1);
  });
  it("protects authentication, origin and account changes", async () => {
    session.mockResolvedValueOnce(null); expect((await POST(request())).status).toBe(401);
    expect((await POST(request(command(), { origin: "https://attacker.test" }))).status).toBe(403);
    const changed = await POST(request(command(), { "X-Kq-School-Owner": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }));
    expect(changed.status).toBe(409); expect((await changed.json()).code).toBe("school_owner_changed");
    expect(health).not.toHaveBeenCalled();
  });
  it("rejects missing CAS revisions and oversized bodies before persistence", async () => {
    expect((await POST(request({ lessonIds: [], checkpointIds: [], activityIds: [], resumeLessonId: "health-observation-1" }))).status).toBe(400);
    expect((await POST(request({ ...command(), extra: "x".repeat(9000) }))).status).toBe(413);
    expect(health).not.toHaveBeenCalled();
  });
});
