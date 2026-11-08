import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), enabled: vi.fn(), admin: vi.fn(), rpc: vi.fn(), from: vi.fn(), rate: vi.fn(),
  select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: mocks.enabled }));
vi.mock("@/lib/admin-guard", () => ({ getValidatedAdminContext: mocks.admin }));
vi.mock("@/lib/security-rate-limit", () => ({ hitRateLimit: mocks.rate }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => ({ rpc: mocks.rpc, from: mocks.from }) }));
import { GET, POST } from "@/app/api/arena/feedback/route";
import { GET as adminGET, PATCH } from "@/app/api/admin/arena/feedback/route";
const id = "12345678-1234-1234-1234-123456789012";
const entry = { id, user_id: "player-id", request_id: id, kind: "bug", subject: "Le bouton bloque", message: "Après le lancer, le bouton ne répond plus.",
  page_path: "/le-placard", status: "new", reply: null, reviewed_by: "private-admin@example.invalid", reward_packs: 0, reward_granted_at: null,
  created_at: "2026-11-08T12:00:00Z", updated_at: "2026-11-08T12:00:00Z" };
const submission = { requestId: id, kind: "bug", subject: entry.subject, message: entry.message, pagePath: "/le-placard" };
function request(body?: unknown, headers?: Record<string, string>, method = "POST", suffix = "") {
  return new Request(`https://quartier.test/api/arena/feedback${suffix}`, { method: body === undefined ? "GET" : method,
    headers: { "content-type": "application/json", origin: "https://quartier.test", ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ customerId: "player-id" });
  mocks.enabled.mockResolvedValue(true);
  mocks.admin.mockResolvedValue({ customerId: "admin", email: "real-admin@example.invalid" });
  mocks.rate.mockResolvedValue({ allowed: true });
  mocks.rpc.mockResolvedValue({ data: { item: entry, replayed: false, rewardGranted: false }, error: null });
  const query = { select: mocks.select, eq: mocks.eq, order: mocks.order, range: mocks.range };
  for (const mock of [mocks.from, mocks.select, mocks.eq, mocks.order]) mock.mockReturnValue(query);
  mocks.range.mockResolvedValue({ data: [entry], count: 1, error: null });
});
describe("player feedback API", () => {
  it("reads only the session's messages, paginates and hides private metadata", async () => {
    const response = await GET(request(undefined, undefined, "GET", "?offset=20&userId=victim"));
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "player-id");
    expect(mocks.range).toHaveBeenCalledWith(20, 39);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.items[0]).toMatchObject({ id, rewardPacks: 0 });
    expect(JSON.stringify(body)).not.toMatch(/private-admin|user_id|request_id|reviewedBy/);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("binds submission to session and ignores forged authority", async () => {
    const response = await POST(request({ ...submission, userId: "victim", status: "resolved", rewardPacks: 5 }));
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_arena_submit_feedback", {
      p_user_id: "player-id", p_request_id: id, p_kind: "bug", p_subject: entry.subject, p_message: entry.message, p_page_path: "/le-placard",
    });
  });
  it("returns the recovered original message on replay", async () => {
    mocks.rpc.mockResolvedValue({ data: { item: { ...entry, status: "resolved", reward_packs: 2 }, replayed: true }, error: null });
    expect(await (await POST(request(submission))).json()).toMatchObject({ replayed: true, item: { status: "resolved", rewardPacks: 2 } });
  });
  it("requires authentication and player access before any persistence", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
    expect((await POST(request(submission))).status).toBe(401);
    mocks.enabled.mockResolvedValue(false);
    expect((await GET(request())).status).toBe(404);
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled();
  });
  it("enforces rate and storage quota errors without leaking SQL details", async () => {
    mocks.rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 23 });
    const limited = await POST(request(submission));
    expect(limited.status).toBe(429); expect(limited.headers.get("Retry-After")).toBe("23");
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rate.mockResolvedValue({ allowed: true });
    for (const [message, status] of [["feedback_daily_limit", 429], ["feedback_request_conflict", 409], ["secret internal table", 503]] as const) {
      mocks.rpc.mockResolvedValue({ error: { message } });
      const response = await POST(request(submission));
      expect(response.status).toBe(status); expect(await response.text()).not.toContain(message);
    }
  });
  it("fails closed on absent counts and malformed data", async () => {
    mocks.range.mockResolvedValue({ data: [], count: null, error: null });
    expect((await GET(request())).status).toBe(503);
    mocks.rpc.mockResolvedValue({ data: {}, error: null });
    expect((await POST(request(submission))).status).toBe(503);
  });
});
describe("admin feedback API", () => {
  it("requires admin authentication for reads and reviews", async () => {
    mocks.admin.mockResolvedValue(null);
    expect((await adminGET(request())).status).toBe(401);
    expect((await PATCH(request({ id, status: "resolved", reply: "Merci" }, undefined, "PATCH"))).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("applies validated filters and bounded pagination", async () => {
    expect((await adminGET(request(undefined, undefined, "GET", "?kind=idea&status=new&offset=30"))).status).toBe(200);
    expect(mocks.eq).toHaveBeenCalledWith("kind", "idea"); expect(mocks.eq).toHaveBeenCalledWith("status", "new");
    expect(mocks.range).toHaveBeenCalledWith(30, 59);
    expect((await adminGET(request(undefined, undefined, "GET", "?status=__proto__"))).status).toBe(400);
  });
  it("binds reviewer identity, exact version and pack amount to the transactional RPC", async () => {
    const response = await PATCH(request({ id, status: "resolved", reply: "Merci !", rewardPacks: 2, reviewedBy: "forged", expectedUpdatedAt: entry.updated_at }, undefined, "PATCH"));
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_arena_review_feedback", {
      p_id: id, p_status: "resolved", p_reply: "Merci !", p_reward_packs: 2, p_reviewed_by: "real-admin@example.invalid", p_expected_updated_at: entry.updated_at,
    });
    mocks.rpc.mockResolvedValue({ error: { message: "feedback_changed" } });
    expect((await PATCH(request({ id, status: "resolved", reply: "Merci !" }, undefined, "PATCH"))).status).toBe(409);
  });
  it("does not request a reward during an ordinary status save", async () => {
    await PATCH(request({ id, status: "planned", reply: "" }, undefined, "PATCH"));
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({ p_reward_packs: 0, p_reply: null });
  });
});
describe("feedback write boundary", () => {
  it.each([POST, PATCH])("rejects wrong/missing Origin and non-JSON bodies before mutation", async handler => {
    const rejectedHeaders: Array<Record<string, string>> = [{ origin: "https://attacker.test" }, { origin: "" }, { "sec-fetch-site": "cross-site" }];
    for (const headers of rejectedHeaders) {
      expect((await handler(request(submission, headers))).status).toBe(403);
    }
    expect((await handler(request(submission, { "content-type": "text/plain" }))).status).toBe(415);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([POST, PATCH])("counts actual streamed bytes when Content-Length lies", async handler => {
    const response = await handler(request({ ...submission, message: "é".repeat(14000) }, { "content-length": "20" }));
    expect(response.status).toBe(413); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([POST, PATCH])("rejects invalid JSON without a server error", async handler => {
    const bad = new Request("https://quartier.test/api/arena/feedback", { method: "POST", body: "{", headers: { "content-type": "application/json", origin: "https://quartier.test" } });
    expect((await handler(bad)).status).toBe(400); expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
