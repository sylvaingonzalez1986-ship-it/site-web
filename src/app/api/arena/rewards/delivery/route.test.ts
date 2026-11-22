import { beforeEach, describe, expect, it, vi } from "vitest";

const { session, order } = vi.hoisted(() => ({ session: vi.fn(), order: vi.fn() }));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: session }));
vi.mock("@/lib/supabase/arena-customer-rewards-backend", () => ({ createArenaPrizeDelivery: order }));

import { POST } from "./route";

const origin = "https://boutique.test";
const grantId = "00000000-0000-4000-8000-000000000010";
const userId = "00000000-0000-4000-8000-000000000011";
const address = { name: "Camille Martin", address: "2 rue des Fleurs", postalCode: "29200", city: "Brest", phone: "06 12 34 56 78" };
const request = (body: unknown, requestOrigin = origin) => new Request(`${origin}/api/arena/rewards/delivery`, {
  method: "POST", headers: { "Content-Type": "application/json", Origin: requestOrigin }, body: JSON.stringify(body),
});

describe("free arena prize delivery route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    session.mockResolvedValue({ customerId: userId, customer: { email: "camille@example.invalid" } });
  });

  it("blocks cross-origin and anonymous writes", async () => {
    expect((await POST(request({ grantId }, "https://other.test"))).status).toBe(403);
    session.mockResolvedValue(null);
    expect((await POST(request({ grantId }))).status).toBe(401);
    expect(order).not.toHaveBeenCalled();
  });

  it("uses the signed-in user and server receipt, ignoring arbitrary amounts or identities", async () => {
    const receipt = { orderId: "LOT-AR-TEST", totalCents: 0, grams: 27 };
    order.mockResolvedValue({ data: receipt, error: null });
    const response = await POST(request({ grantId, ...address, userId: "other", email: "other@example.invalid", totalCents: 500 }));
    expect(await response.json()).toEqual(receipt);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(order).toHaveBeenCalledWith(grantId, userId, { ...address, phone: "+33612345678", email: "camille@example.invalid" });
  });

  it("returns a recoverable error and conceals a grant owned by someone else", async () => {
    order.mockResolvedValueOnce({ data: null, error: { message: "arena_customer_prize_not_found" } });
    order.mockRejectedValueOnce(new Error("Réponse indisponible"));
    expect((await POST(request({ grantId, ...address }))).status).toBe(404);
    expect((await POST(request({ grantId, ...address }))).status).toBe(503);
  });
});
