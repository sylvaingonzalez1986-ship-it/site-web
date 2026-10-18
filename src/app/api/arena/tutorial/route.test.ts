import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), enabled: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), upsert: vi.fn(), update: vi.fn(), updateResult: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: mocks.enabled }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => ({ from: mocks.from }) }));
import { GET, POST } from "./route";
vi.mock("@/lib/supabase/arena-chanvrier-backend", () => ({ getChanvrierProfile: vi.fn(async () => null) }));
const request = (body: unknown) => new Request("http://localhost/api/arena/tutorial", { method: "POST", body: JSON.stringify(body) });

describe("arena tutorial preferences API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue({ customerId: "signed-in-user" });
    mocks.enabled.mockResolvedValue(true);
    const query = { select: mocks.select, eq: mocks.eq, maybeSingle: mocks.maybeSingle, upsert: mocks.upsert, update: mocks.update,
      then: (resolve: (result: unknown) => void, reject: (reason: unknown) => void) => mocks.updateResult().then(resolve, reject) };
    mocks.from.mockReturnValue(query); mocks.select.mockReturnValue(query); mocks.eq.mockReturnValue(query);
    mocks.update.mockReturnValue(query);
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.updateResult.mockResolvedValue({ error: null });
  });
  it("loads private progress for the authenticated account only", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ userId: "signed-in-user", chanvrier: null, progress: { step: 0, status: "new" }, persisted: true });
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
  it.each([null, "new", "active", "completed", "skipped"])("acknowledges the first visible introduction without regressing an existing %s preference", async status => {
    let stored: Record<string, unknown> | null = status === null ? null : { user_id: "signed-in-user", version: 2, step: status === "new" ? 0 : 9, status };
    const previous = stored;
    mocks.upsert.mockImplementation(async (value: Record<string, unknown>, options: { ignoreDuplicates?: boolean }) => {
      if (!stored || !options.ignoreDuplicates) stored = value;
      return { error: null };
    });
    mocks.updateResult.mockImplementation(async () => {
      if (stored && mocks.eq.mock.calls.every(([key, value]) => stored?.[key] === value)) {
        stored = { ...stored, ...mocks.update.mock.calls.at(-1)?.[0] };
      }
      return { error: null };
    });
    const response = await POST(request({ intent: "introduction", step: 0, status: "active", user_id: "victim", version: 10 }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ progress: { step: 0, status: "active" }, persisted: true });
    if (status === null || status === "new") expect(stored).toMatchObject({ user_id: "signed-in-user", version: 2, step: 0, status: "active" });
    else expect(stored).toEqual(previous);
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "signed-in-user");
    expect(mocks.eq).toHaveBeenCalledWith("version", 2);
    expect(mocks.eq).toHaveBeenCalledWith("status", "new");
  });
  it("restricts introduction acknowledgment to starting at the first chapter", async () => {
    for (const body of [
      { intent: "introduction", step: 1, status: "active" },
      { intent: "introduction", step: 0, status: "new" },
      { intent: "introduction", step: 0, status: "completed" },
      { intent: "unknown", step: 0, status: "active" },
    ]) expect((await POST(request(body))).status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("keeps the local fallback when introduction persistence is unavailable", async () => {
    mocks.upsert.mockResolvedValue({ error: { code: "42P01" } });
    expect(await (await POST(request({ intent: "introduction", step: 0, status: "active" }))).json()).toMatchObject({ persisted: false });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("reports introduction update failures without exposing private database details", async () => {
    mocks.updateResult.mockResolvedValue({ error: { code: "42501", message: "private SQL details" } });
    const response = await POST(request({ intent: "introduction", step: 0, status: "active" }));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private SQL");
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
