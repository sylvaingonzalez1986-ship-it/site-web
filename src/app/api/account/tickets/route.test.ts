import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), orders: vi.fn(), tickets: vi.fn(), inventory: vi.fn(), config: vi.fn(), bonuses: vi.fn(),
  purchase: vi.fn(), rateLimit: vi.fn(), audit: vi.fn(),
}));
vi.mock("@/lib/customer-backend", () => ({ getCurrentCustomerSessionByBackend: mocks.session }));
vi.mock("@/lib/supabase/loyalty-orders", () => ({ readLoyaltyOrdersForCustomerFromSupabase: mocks.orders }));
vi.mock("@/lib/lottery-backend", () => ({
  getLotteryTicketsForCustomerByBackend: mocks.tickets, getLotteryInventoryForCustomerByBackend: mocks.inventory,
  getLotteryConfigByBackend: mocks.config, listLotteryBonusInstancesForCustomerByBackend: mocks.bonuses,
  purchaseLotteryPacksWithPointsByBackend: mocks.purchase,
}));
vi.mock("@/lib/security-rate-limit", () => ({
  getRequestIp: () => "127.0.0.1", hitRateLimit: mocks.rateLimit, logRateLimitRejection: vi.fn(),
}));
vi.mock("@/lib/audit-log", () => ({ logAuditEvent: mocks.audit }));
vi.mock("@/lib/body-size-guard", () => ({ readRequestBody: async (request: Request) => ({ ok: true, body: request }) }));

import { LOTTERY_POINTS_PACK_COST } from "@/lib/lottery-collection";
import { GET, POST } from "./route";

const userId = "11111111-1111-4111-8111-111111111111";
const getRequest = () => new Request("https://album.test/api/account/tickets");
const postRequest = () => new Request("https://album.test/api/account/tickets", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packCount: 2 }),
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ customerId: userId, customer: { email: "test@example.test", loyaltyPoints: 500, loyaltyPointsSpent: 100 } });
  mocks.rateLimit.mockResolvedValue({ allowed: true });
  mocks.orders.mockResolvedValue([
    { status: "paid", paymentState: "paid", totalAmount: 1250.75 },
    { status: "cancelled", paymentState: "paid", totalAmount: 900 },
  ]);
  mocks.tickets.mockResolvedValue([{ id: "sealed", status: "available" }]);
  mocks.inventory.mockResolvedValue({ cards: [] }); mocks.config.mockResolvedValue({ isActive: true });
  mocks.bonuses.mockResolvedValue([]); mocks.purchase.mockResolvedValue(2);
});

describe("account tickets loyalty reads", () => {
  it("loads packs and the complete customer balance from the dedicated order reader", async () => {
    const response = await GET(getRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      tickets: [{ id: "sealed", status: "available" }],
      loyalty: { basePoints: 1250, bonusPoints: 500, spendablePoints: 1650, eligibleOrdersCount: 1 },
    });
    expect(mocks.orders).toHaveBeenCalledExactlyOnceWith(userId);
    expect(mocks.purchase).not.toHaveBeenCalled();
  });

  it("uses the same complete base points for purchase and the resulting displayed balance", async () => {
    const response = await POST(postRequest());
    expect(response.status).toBe(200);
    expect(mocks.orders).toHaveBeenCalledExactlyOnceWith(userId);
    expect(mocks.purchase).toHaveBeenCalledExactlyOnceWith({ userId, packCount: 2, basePoints: 1250 });
    expect(await response.json()).toEqual({ granted: 2, costPoints: 2 * LOTTERY_POINTS_PACK_COST, spendablePoints: 1650 - 2 * LOTTERY_POINTS_PACK_COST });
  });

  it("reports unavailable loyalty without fabricating an empty successful account", async () => {
    mocks.orders.mockRejectedValue(new Error("[supabase:read customer loyalty orders] fetch failed"));
    const response = await GET(getRequest());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "[supabase:read customer loyalty orders] fetch failed" });
  });

  it("never purchases packs when the complete base balance cannot be loaded", async () => {
    mocks.orders.mockRejectedValue(new Error("[supabase:read customer loyalty orders] fetch failed"));
    expect((await POST(postRequest())).status).toBe(500);
    expect(mocks.purchase).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("does not replay a failed purchase RPC", async () => {
    mocks.purchase.mockRejectedValue(new Error("[supabase:purchase] fetch failed"));
    expect((await POST(postRequest())).status).toBe(500);
    expect(mocks.purchase).toHaveBeenCalledTimes(1);
  });

  it("does not read account orders without a session", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET(getRequest())).status).toBe(401);
    expect((await POST(postRequest())).status).toBe(401);
    expect(mocks.orders).not.toHaveBeenCalled();
  });
});
