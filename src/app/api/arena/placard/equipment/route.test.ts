import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), enabled: vi.fn(), replace: vi.fn(), rate: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: mocks.enabled }));
vi.mock("@/lib/security-rate-limit", () => ({ getRequestIp: () => "127.0.0.1", hitRateLimit: mocks.rate, logRateLimitRejection: vi.fn() }));
vi.mock("@/lib/supabase/kanab-quest-equipment-backend", () => ({
  replaceKqCultureEquipment: mocks.replace, getKqEquipmentShopSnapshot: vi.fn(), equipKqDurableEquipment: vi.fn(),
  purchaseKqDurableEquipment: vi.fn(), setKqEquipmentRoutePlan: vi.fn(), upgradeKqDurableEquipment: vi.fn(), repairKqMachine: vi.fn(),
}));
import { PATCH } from "./route";
const body = { action: "replace", equipmentCode: "LED-300", requestKey: "replacement-key", expectedVersion: 10, expectedCostCents: 35900 };
const request = (extra: Record<string, unknown> = {}) => new Request("http://localhost/api/arena/placard/equipment", { method: "PATCH", body: JSON.stringify({ ...body, ...extra }) });
describe("culture equipment replacement endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.enabled.mockResolvedValue(true);
    mocks.session.mockResolvedValue({ customerId: "session-owner", customer: { email: "owner@example.test" } });
    mocks.rate.mockResolvedValue({ allowed: true }); mocks.replace.mockResolvedValue({ paidCents: 35900, level: 1 });
  });
  it("requires feature access and authentication before replacing", async () => {
    mocks.enabled.mockResolvedValue(false); expect((await PATCH(request())).status).toBe(404);
    expect(mocks.session).not.toHaveBeenCalled();
    mocks.enabled.mockResolvedValue(true); mocks.session.mockResolvedValue(null);
    expect((await PATCH(request())).status).toBe(401); expect(mocks.replace).not.toHaveBeenCalled();
  });
  it("uses the authenticated owner and the confirmed price/version", async () => {
    expect((await PATCH(request({ userId: "another-player" }))).status).toBe(200);
    expect(mocks.replace).toHaveBeenCalledWith({ userId: "session-owner", equipmentCode: "LED-300", requestKey: "replacement-key", expectedVersion: 10, expectedCostCents: 35900 });
  });
  it("rate limits replacements before spending any cash", async () => {
    mocks.rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 12 });
    const response = await PATCH(request()); expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("12"); expect(mocks.replace).not.toHaveBeenCalled();
  });
  it("passes missing confirmations as invalid values", async () => {
    await PATCH(request({ expectedCostCents: undefined, expectedVersion: undefined }));
    expect(mocks.replace).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: -1, expectedCostCents: -1 }));
  });
  it("preserves gameplay errors while hiding database internals", async () => {
    mocks.replace.mockRejectedValueOnce(new Error("Termine la culture en cours avant de remplacer le matériel."));
    let response = await PATCH(request()); expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Termine la culture en cours avant de remplacer le matériel." });
    mocks.replace.mockRejectedValueOnce(new Error("[supabase:culture-equipment-replacement] private data"));
    response = await PATCH(request()); expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Service momentanément indisponible." });
  });
});
