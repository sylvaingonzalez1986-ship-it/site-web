import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), enabled: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: mocks.enabled }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => ({ from: mocks.from }) }));
import { GET, POST } from "./route";
const request = (body: unknown) => new Request("http://localhost/api/arena/tutorial", { method: "POST", body: JSON.stringify(body) });

describe("arena tutorial preferences API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue({ customerId: "signed-in-user" });
    mocks.enabled.mockResolvedValue(true);
    const query = { select: mocks.select, eq: mocks.eq, maybeSingle: mocks.maybeSingle, upsert: mocks.upsert };
    mocks.from.mockReturnValue(query); mocks.select.mockReturnValue(query); mocks.eq.mockReturnValue(query);
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.upsert.mockResolvedValue({ error: null });
  });
  it("loads private progress for the authenticated account only", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ userId: "signed-in-user", progress: { step: 0, status: "new" }, persisted: true });
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "signed-in-user");
    expect(mocks.eq).toHaveBeenCalledWith("version", 2);
  });
  it("does not access storage for guests or when the game is disabled", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await POST(request({ step: 1, status: "active" }))).status).toBe(401);
    mocks.session.mockResolvedValue({ customerId: "signed-in-user" });
    mocks.enabled.mockResolvedValue(false);
    expect((await GET()).status).toBe(404);
    expect((await POST(request({ step: 1, status: "active" }))).status).toBe(404);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("writes preferences with server identity/version, ignoring forged rewards", async () => {
    const response = await POST(request({ step: 2, status: "active", user_id: "victim", version: 100, packs: 100 }));
    expect(response.status).toBe(200);
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith("arena_journey_progress");
    expect(mocks.upsert).toHaveBeenCalledWith({ user_id: "signed-in-user", version: 2, step: 2, status: "active", updated_at: expect.any(String) }, { onConflict: "user_id,version" });
  });
  it("rejects invalid progress and malformed JSON", async () => {
    for (const body of [null, [], {}, { step: 10, status: "active" }, { step: 1, status: "invalid" }]) expect((await POST(request(body))).status).toBe(400);
    expect((await POST(new Request("http://localhost", { method: "POST", body: "{" }))).status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it.each(["42P01", "PGRST205"])("allows local fallback while the migration is missing (%s)", async (code) => {
    mocks.maybeSingle.mockResolvedValue({ error: { code } }); mocks.upsert.mockResolvedValue({ error: { code } });
    expect(await (await GET()).json()).toMatchObject({ userId: "signed-in-user", persisted: false });
    expect(await (await POST(request({ step: 9, status: "completed" }))).json()).toEqual({ progress: { step: 9, status: "completed" }, persisted: false });
  });
  it("reports other database failures without leaking details", async () => {
    mocks.maybeSingle.mockResolvedValue({ error: { code: "42501", message: "private SQL details" } });
    mocks.upsert.mockRejectedValue(new Error("private SQL details"));
    for (const response of [await GET(), await POST(request({ step: 1, status: "active" }))]) {
      expect(response.status).toBe(503); expect(await response.text()).not.toContain("private SQL");
    }
  });
});
