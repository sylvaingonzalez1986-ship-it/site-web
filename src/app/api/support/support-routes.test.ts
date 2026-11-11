import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ getSupportSummary: vi.fn(), getAdminSupportDashboard: vi.fn(), getAdminSupportRows: vi.fn(), getSupportVivaConfig: vi.fn(), mutateSupportAdmin: vi.fn(), findSupportForReconciliation: vi.fn(),
  getValidatedAdminContext: vi.fn(), hitRateLimit: vi.fn(), getRequestIp: vi.fn(), startSupportPayment: vi.fn(), refreshOwnedSupport: vi.fn(), cancelOwnedSupport: vi.fn(), handleSupportWebhook: vi.fn(), reconcileAdminSupport: vi.fn() }));
vi.mock("@/lib/support-backend", () => mock);
vi.mock("@/lib/support-viva", () => mock);
vi.mock("@/lib/admin-guard", () => mock);
vi.mock("@/lib/security-rate-limit", () => mock);
import { GET as publicSummary } from "./route";
import { POST as checkout } from "./checkout/route";
import { POST as status } from "./status/route";
import { POST as cancel } from "./cancel/route";
import { POST as webhook } from "./viva/webhook/route";
import { GET as adminGet, POST as adminPost } from "../admin/support/route";
const origin = "https://site.test";
const body = { id: "11111111-1111-4111-8111-111111111111", token: "a".repeat(64), pseudonym: "Breton", amountCents: 1000, publishName: true, publishAmount: false };
const req = (payload: unknown, headers: Record<string, string> = {}) => new Request(`${origin}/api/support`, { method: "POST", headers: { "content-type": "application/json", origin, ...headers }, body: JSON.stringify(payload) });
beforeEach(() => { vi.resetAllMocks(); mock.hitRateLimit.mockResolvedValue({ allowed: true }); mock.getRequestIp.mockReturnValue("127.0.0.1"); mock.getSupportVivaConfig.mockReturnValue({ isConfigured: true }); mock.startSupportPayment.mockResolvedValue({ state: "ready" }); mock.refreshOwnedSupport.mockResolvedValue({ state: "paid" }); mock.getValidatedAdminContext.mockResolvedValue(null); });
describe("support public and admin boundaries", () => {
  it("rejects cross-origin mutations before creating or verifying any payment", async () => {
    for (const handler of [checkout, status, cancel]) expect((await handler(req(body, { origin: "https://evil.test" }))).status).toBe(403);
    expect(mock.startSupportPayment).not.toHaveBeenCalled(); expect(mock.refreshOwnedSupport).not.toHaveBeenCalled(); expect(mock.cancelOwnedSupport).not.toHaveBeenCalled();
  });
  it("accepts a bounded guest form and returns uncached state", async () => {
    const response = await checkout(req(body)); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store"); expect(mock.startSupportPayment).toHaveBeenCalledWith(body);
  });
  it("rejects invalid amounts and missing publication choices", async () => {
    for (const change of [{ amountCents: 10.5 }, { amountCents: 100001 }, { publishName: "yes" }, { token: "" }, { pseudonym: "<script>" }]) expect((await checkout(req({ ...body, ...change }))).status).toBe(400);
    expect(mock.startSupportPayment).not.toHaveBeenCalled();
  });
  it("enforces body and rate limits before external operations", async () => {
    expect((await checkout(req({ ...body, extra: "x".repeat(5000) }))).status).toBe(413);
    mock.hitRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 60 });
    const limited = await checkout(req(body)); expect(limited.status).toBe(429); expect(limited.headers.get("retry-after")).toBe("60"); expect(mock.startSupportPayment).not.toHaveBeenCalled();
  });
  it("passes transaction hints only with the private owner credentials", async () => {
    expect((await status(req({ id: body.id, transactionId: body.id }))).status).toBe(400);
    await status(req({ id: body.id, token: body.token, transactionId: body.id }));
    expect(mock.refreshOwnedSupport).toHaveBeenCalledWith(body.id, body.token, body.id);
  });
  it("requires admin identity for reads, CSV exports and writes", async () => {
    expect((await adminGet(new Request(`${origin}/api/admin/support?format=csv`))).status).toBe(401);
    expect((await adminPost(req({ action: "campaign", active: true, goalCents: 10000 }))).status).toBe(401);
    expect(mock.getAdminSupportRows).not.toHaveBeenCalled(); expect(mock.mutateSupportAdmin).not.toHaveBeenCalled();
  });
  it("requires a distinct configured source before opening the campaign", async () => {
    mock.getValidatedAdminContext.mockResolvedValue({ customerId: "admin" }); mock.getSupportVivaConfig.mockReturnValue({ isConfigured: false, configurationError: "Source manquante" });
    expect((await adminPost(req({ action: "campaign", active: true, goalCents: null }))).status).toBe(409);
    expect(mock.mutateSupportAdmin).not.toHaveBeenCalled();
  });
  it("audits configuration changes with the authenticated actor, not a supplied actor", async () => {
    mock.getValidatedAdminContext.mockResolvedValue({ customerId: "real-admin" });
    await adminPost(req({ action: "campaign", active: false, goalCents: null, actor: "forged" }));
    expect(mock.mutateSupportAdmin).toHaveBeenCalledWith("campaign", null, { active: false, goalCents: null }, "real-admin");
  });
  it("uses Paris calendar boundaries and rejects reversed or malformed dates", async () => {
    mock.getValidatedAdminContext.mockResolvedValue({ customerId: "admin" }); mock.getAdminSupportDashboard.mockResolvedValue({});
    await adminGet(new Request(`${origin}/api/admin/support?from=2026-03-29&to=2026-03-29`));
    expect(mock.getAdminSupportDashboard).toHaveBeenCalledWith({ from: "2026-03-28T23:00:00.000Z", until: "2026-03-29T22:00:00.000Z" }, 0);
    expect((await adminGet(new Request(`${origin}/api/admin/support?from=2026-02-30`))).status).toBe(400);
  });
  it("preserves large provider order codes and passes a parent only as a verification hint", async () => {
    const payload = `{"EventTypeId":1797,"EventData":{"OrderCode":987654321012345678,"TransactionId":"${body.id}","SourceCode":"Default","ParentId":"22222222-2222-4222-8222-222222222222","Amount":-10}}`;
    const response = await webhook(new Request(`${origin}/api/support/viva/webhook`, { method: "POST", headers: { "content-type": "application/json" }, body: payload }));
    expect(response.status).toBe(200); expect(mock.handleSupportWebhook).toHaveBeenCalledWith("987654321012345678", body.id, "Default", "22222222-2222-4222-8222-222222222222");
  });
  it("does not substitute a missing total with zero", async () => {
    mock.getSupportSummary.mockRejectedValue(new Error("db unavailable"));
    const response = await publicSummary(new Request(`${origin}/api/support`)); expect(response.status).toBe(503); expect(await response.json()).not.toHaveProperty("collectedCents");
  });
});
