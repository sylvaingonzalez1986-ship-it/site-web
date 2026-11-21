import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "./route";

const mocks = vi.hoisted(() => ({
  guard: vi.fn(), getOrder: vi.fn(), archive: vi.fn(), requestArchive: vi.fn(),
  cancelViva: vi.fn(), audit: vi.fn(),
}));
vi.mock("@/lib/admin-guard", () => ({ denyIfNotAdminApi: mocks.guard }));
vi.mock("@/lib/order-backend", () => ({ getOrderByIdByBackend: mocks.getOrder, archiveIncompleteOrderByBackend: mocks.archive }));
vi.mock("@/lib/swiss-bitcoin-pay-service", () => ({ requestSwissBitcoinOrderArchive: mocks.requestArchive }));
vi.mock("@/lib/viva-payment", () => ({ cancelVivaPaymentOrder: mocks.cancelViva, getVivaConfig: () => ({}) }));
vi.mock("@/lib/audit-log", () => ({ logAuditEvent: mocks.audit }));

const order = { id: "order-1", status: "pending_payment", paymentState: "pending", paymentProvider: "swiss_bitcoin_pay" };
const requestedAt = "2026-11-21T11:01:00Z";
function remove() {
  return DELETE(new Request("https://shop.example/api/admin/orders/order-1", { method: "DELETE" }), {
    params: Promise.resolve({ orderId: order.id }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getOrder.mockResolvedValue(order);
});

describe("admin removal of unpaid Bitcoin orders", () => {
  it("confirms a scheduled withdrawal without removing a payable order from the list", async () => {
    const scheduled = { ...order, swissBitcoinArchiveRequestedAt: requestedAt };
    mocks.getOrder.mockResolvedValueOnce(order).mockResolvedValueOnce(scheduled);
    mocks.requestArchive.mockResolvedValue("scheduled");
    const response = await remove();
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual(scheduled);
    expect(mocks.requestArchive).toHaveBeenCalledWith(order.id);
    expect(mocks.archive).not.toHaveBeenCalled();
    expect(mocks.cancelViva).not.toHaveBeenCalled();
    expect(mocks.audit).toHaveBeenCalledWith({ eventType: "request_order_archive", metadata: { orderId: order.id } });
  });

  it.each(["archived", "scheduled"])("returns the archived order if the database has finished removal (%s)", async (action) => {
    const archived = { ...order, status: "cancelled", paymentState: "failed", archivedAt: requestedAt };
    mocks.getOrder.mockResolvedValueOnce(order).mockResolvedValueOnce(archived);
    mocks.requestArchive.mockResolvedValue(action);
    const response = await remove();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(archived);
  });

  it("keeps an order visible if a settlement arrives during the request", async () => {
    mocks.getOrder.mockResolvedValueOnce(order).mockResolvedValueOnce({ ...order, paymentState: "paid", status: "paid" });
    mocks.requestArchive.mockResolvedValue("scheduled");
    expect((await remove()).status).toBe(409);
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("blocks a card switch in progress and leaves the provider session intact", async () => {
    mocks.getOrder.mockResolvedValue({ ...order, swissBitcoinCardStartedAt: requestedAt });
    mocks.requestArchive.mockResolvedValue("blocked");
    expect((await remove()).status).toBe(409);
    expect(mocks.archive).not.toHaveBeenCalled();
    expect(mocks.cancelViva).not.toHaveBeenCalled();
  });

  it("preserves the card cancellation flow on a completed switch", async () => {
    const card = { ...order, paymentProvider: "viva", swissBitcoinCardStartedAt: requestedAt, vivaOrderCode: "12345" };
    mocks.getOrder.mockResolvedValue(card);
    mocks.archive.mockResolvedValue({ ...card, archivedAt: requestedAt });
    expect((await remove()).status).toBe(200);
    expect(mocks.cancelViva).toHaveBeenCalledWith({ config: {}, orderCode: "12345" });
    expect(mocks.requestArchive).not.toHaveBeenCalled();
  });

  it("keeps the admin guard ahead of any read or write", async () => {
    mocks.guard.mockResolvedValue(new Response(null, { status: 401 }));
    expect((await remove()).status).toBe(401);
    expect(mocks.getOrder).not.toHaveBeenCalled();
  });
});
