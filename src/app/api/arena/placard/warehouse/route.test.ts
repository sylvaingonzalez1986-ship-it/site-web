import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(), enabled: vi.fn(), rate: vi.fn(), snapshot: vi.fn(), save: vi.fn(), quote: vi.fn(), remove: vi.fn(),
}));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: mocks.enabled }));
vi.mock("@/lib/security-rate-limit", () => ({ getRequestIp: () => "test", hitRateLimit: mocks.rate }));
vi.mock("@/lib/supabase/kanab-quest-warehouse-backend", () => ({
  getKqWarehouseSnapshot: mocks.snapshot, saveKqWarehouseLayout: mocks.save,
  quoteKqWarehouseZoneRemoval: mocks.quote, removeKqWarehouseCultureZone: mocks.remove,
  KqWarehouseError: class extends Error {
    constructor(message: string, public status = 400) { super(message); }
  },
}));
import { GET, PATCH, POST } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.enabled.mockResolvedValue(true);
  mocks.session.mockResolvedValue({ customerId: "authenticated-owner" });
  mocks.rate.mockResolvedValue({ allowed: true });
  mocks.snapshot.mockResolvedValue({ revision: 1 });
  mocks.save.mockResolvedValue({ revision: 2 });
  mocks.quote.mockResolvedValue({ resaleCents: 1000 });
  mocks.remove.mockResolvedValue({ revision: 2 });
});

describe("warehouse API access", () => {
  it("authenticates quote and removal commands and ignores an injected owner", async () => {
    const body = { action: "quote-zone-removal", userId: "another-player", zoneId: "zone", expectedRevision: 1 };
    const send = () => POST(new Request("https://example.test/api/arena/placard/warehouse", { method: "POST", body: JSON.stringify(body) }));
    expect((await send()).status).toBe(200);
    expect(mocks.quote).toHaveBeenCalledWith({ userId: "authenticated-owner", zoneId: "zone", expectedRevision: 1 });
    mocks.session.mockResolvedValue(null);
    expect((await send()).status).toBe(401);
    expect(mocks.quote).toHaveBeenCalledTimes(1);
  });
  it("requires a recognized command and passes the exact confirmed resale request", async () => {
    const send = (body: unknown) => POST(new Request("https://example.test/api/arena/placard/warehouse", { method: "POST", body: JSON.stringify(body) }));
    expect((await send({ action: "give-money" })).status).toBe(400);
    const command = { action: "remove-zone", zoneId: "zone", expectedRevision: 1, resellEquipment: true, expectedResaleCents: 1000, requestKey: "request" };
    expect((await send(command)).status).toBe(200);
    expect(mocks.remove).toHaveBeenCalledWith({ userId: "authenticated-owner", zoneId: "zone", expectedRevision: 1, resellEquipment: true, expectedResaleCents: 1000, requestKey: "request" });
  });
  it("requires an authenticated player before reading or editing a plan", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await PATCH(new Request("https://example.test/api/arena/placard/warehouse", { method: "PATCH", body: "{}" }))).status).toBe(401);
    expect(mocks.snapshot).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("takes ownership only from the session and disables caching private state", async () => {
    const state = { version: 1 };
    const response = await PATCH(new Request("https://example.test/api/arena/placard/warehouse", {
      method: "PATCH", body: JSON.stringify({ userId: "another-player", state, expectedRevision: 1, expectedCostCents: 15, requestKey: "key", free: true }),
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.save).toHaveBeenCalledWith({ userId: "authenticated-owner", state, expectedRevision: 1, expectedCostCents: 15, requestKey: "key" });
  });

  it("bounds the actual received body even when no content length was supplied", async () => {
    const response = await PATCH(new Request("https://example.test/api/arena/placard/warehouse", { method: "PATCH", body: " ".repeat(300_001) }));
    expect(response.status).toBe(413);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("rate limits writes before body processing", async () => {
    mocks.rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 17 });
    const response = await PATCH(new Request("https://example.test/api/arena/placard/warehouse", { method: "PATCH", body: "{}" }));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("17");
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("does not disclose database errors or silently report success", async () => {
    mocks.snapshot.mockRejectedValue(new Error("[supabase:warehouse] secret internal relation"));
    const response = await GET();
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("relation");
  });
});
