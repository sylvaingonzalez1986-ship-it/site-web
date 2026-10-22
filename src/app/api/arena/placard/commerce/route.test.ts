import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), enabled: vi.fn(), rate: vi.fn(), snapshot: vi.fn(), action: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/kanab-quest-player-request-access", () => ({ isKqPlayerRequestEnabled: mocks.enabled }));
vi.mock("@/lib/security-rate-limit", () => ({ getRequestIp: () => "127.0.0.1", hitRateLimit: mocks.rate, logRateLimitRejection: vi.fn() }));
vi.mock("@/lib/supabase/kanab-quest-commerce-backend", () => ({ getKqCommerceSnapshot: mocks.snapshot, handleKqCommerceAction: mocks.action }));
import { GET, POST } from "./route";
import { KqCommerceOfferChangedError } from "@/lib/kanab-quest-commerce-errors";

const request = (body: unknown) => new Request("http://localhost/api/arena/placard/commerce", { method: "POST", body: JSON.stringify(body) });
const command = { action: "online", command: "create-listing", payload: { stockId: "stock", formatGrams: 5, packagingCode: "kraft-5", packets: 2, packetPriceCents: 1234 }, requestKey: "key" };

describe("online commerce endpoint boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled.mockResolvedValue(true);
    mocks.session.mockResolvedValue({ customerId: "session-owner", customer: { email: "owner@example.test" } });
    mocks.rate.mockResolvedValue({ allowed: true });
    mocks.snapshot.mockResolvedValue({ online: { version: 1, listings: [] } });
    mocks.action.mockResolvedValue({ action: "create-listing", cashAfterCents: 9000 });
  });

  it("uses only the authenticated owner for a listing command", async () => {
    const response = await POST(request({ ...command, userId: "other-player" }));
    expect(response.status).toBe(200);
    expect(mocks.action).toHaveBeenCalledWith("session-owner", expect.objectContaining(command));
    expect(await response.json()).toEqual({ action: "create-listing", cashAfterCents: 9000 });
  });

  it("keeps access, authentication and rate limits ahead of mutations", async () => {
    mocks.enabled.mockResolvedValue(false);
    expect((await POST(request(command))).status).toBe(404);
    expect(mocks.session).not.toHaveBeenCalled();
    mocks.enabled.mockResolvedValue(true); mocks.session.mockResolvedValue(null);
    expect((await POST(request(command))).status).toBe(401);
    mocks.session.mockResolvedValue({ customerId: "session-owner", customer: {} });
    mocks.rate.mockResolvedValue({ allowed: false, retryAfterSeconds: 9 });
    const response = await POST(request(command));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("9");
    expect(mocks.action).not.toHaveBeenCalled();
  });

  it("returns private uncached snapshots and honors the lightweight shop read", async () => {
    const response = await GET(new Request("http://localhost/api/arena/placard/commerce?shop=1&userId=other-player"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.snapshot).toHaveBeenCalledWith("session-owner", true);
  });

  it("rejects non-object request bodies before dispatch", async () => {
    for (const body of [null, [], "online"]) expect((await POST(request(body))).status).toBe(400);
    expect(mocks.action).not.toHaveBeenCalled();
  });

  it("explains gameplay failures while hiding database details", async () => {
    mocks.action.mockRejectedValueOnce(new Error("Achète les emballages nécessaires."));
    let response = await POST(request(command));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Achète les emballages nécessaires." });
    mocks.action.mockRejectedValueOnce(new Error("[supabase:commerce] private database detail"));
    response = await POST(request(command));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("private database detail");
  });

  it.each(["commerce_offer_changed", "commerce_storage_changed"] as const)("returns a recoverable conflict only for a rejected %s transaction", async code => {
    const message = "Recalcule l’offre avant de confirmer.";
    mocks.action.mockRejectedValueOnce(new KqCommerceOfferChangedError(message, code));
    const response = await POST(request({ action: "sell", quoteId: "quote", expectedPayoutCents: 1000, requestKey: "key" }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: message, code });
  });
});
