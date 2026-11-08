import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), enabled: vi.fn(), archive: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: mocks.enabled }));
vi.mock("@/lib/supabase/kanab-quest-staff-backend", () => ({ getKqStaffArchive: mocks.archive }));
import { GET } from "./route";
const request = (query = "") => new Request(`http://localhost/api/arena/placard/staff/archive${query}`);
beforeEach(() => {
  vi.clearAllMocks(); mocks.enabled.mockResolvedValue(true);
  mocks.session.mockResolvedValue({ customerId: "session-owner" });
  mocks.archive.mockResolvedValue({ items: [], nextCursor: null });
});
describe("staff archive owner reads", () => {
  it("checks access and session before reading the archive", async () => {
    mocks.enabled.mockResolvedValue(false);
    expect((await GET(request())).status).toBe(404); expect(mocks.session).not.toHaveBeenCalled();
    mocks.enabled.mockResolvedValue(true); mocks.session.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401); expect(mocks.archive).not.toHaveBeenCalled();
  });
  it("binds cursor and employee filters to the session with no shared caching", async () => {
    const params = new URLSearchParams({ kind: "payroll", employeeId: "33333333-3333-4333-8333-333333333333", afterAt: "2026-11-07T10:00:00.123456+00:00", afterId: "employee:end" });
    const response = await GET(request(`?${params}`));
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("private, no-store");
    expect(mocks.archive).toHaveBeenCalledExactlyOnceWith("session-owner", Object.fromEntries(params));
    expect(await response.json()).toEqual({ items: [], nextCursor: null });
  });
  it.each(["?userId=forged", "?kind=contract&kind=task", "?employeeId=one&employeeId=two", "?limit=100000"])("rejects forged or ambiguous parameters %s", async query => {
    expect((await GET(request(query))).status).toBe(400); expect(mocks.archive).not.toHaveBeenCalled();
  });
  it("keeps internal failures private and exposes validation errors", async () => {
    mocks.archive.mockRejectedValue(new Error("[supabase:staff] private table detail"));
    const response = await GET(request()); expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private table detail"); expect(response.headers.get("cache-control")).toContain("no-store");
    mocks.archive.mockRejectedValue(new Error("La demande d’archives est invalide."));
    expect((await GET(request())).status).toBe(400);
  });
});
