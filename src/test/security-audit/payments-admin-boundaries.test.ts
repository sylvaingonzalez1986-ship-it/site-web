import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Regression coverage for the payment audit findings.
// All DB/provider/email operations are mocked and unexpected network is blocked.
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), from: vi.fn(), deny: vi.fn(), getOrder: vi.fn(), archive: vi.fn(),
  cancelProvider: vi.fn(), update: vi.fn(), invoice: vi.fn(), loyalty: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => ({ rpc: mocks.rpc, from: mocks.from }) }));
vi.mock("@/lib/admin-guard", () => ({ denyIfNotAdminApi: mocks.deny }));
vi.mock("@/lib/audit-log", () => ({ logAuditEvent: vi.fn() }));
vi.mock("@/lib/invoice-store", () => ({ issueInvoiceForOrder: mocks.invoice }));
vi.mock("@/lib/order-email", () => ({ sendOrderProcessingEmail: vi.fn(), sendOrderShippedEmail: vi.fn() }));
vi.mock("@/lib/lottery-backend", () => ({
  consumeLotteryRewardClaimsForOrderByBackend: vi.fn(), mintLotteryTicketsForOrderByBackend: vi.fn(),
  releaseLotteryRewardClaimsForOrderByBackend: vi.fn(),
}));
vi.mock("@/lib/referral-backend", () => ({ applyReferralRewardForPaidOrderByBackend: vi.fn() }));
vi.mock("@/lib/order-backend", () => ({
  getOrderByIdByBackend: mocks.getOrder, archiveIncompleteOrderByBackend: mocks.archive,
  applyOrderLoyaltyBonusByBackend: mocks.loyalty, updateOrderAdminFieldsByBackend: mocks.update,
  updateOrderPaymentStateByBackend: vi.fn(),
}));
vi.mock("@/lib/viva-payment", () => ({ cancelVivaPaymentOrder: mocks.cancelProvider, getVivaConfig: () => ({ isConfigured: true }) }));

import { DELETE, PATCH } from "@/app/api/admin/orders/[orderId]/route";
import { updateOrderPaymentStateInSupabase, updateOrderAdminFieldsInSupabase } from "@/lib/supabase/order-backend";

const pending = { id: "AUDIT-ONLY", paymentState: "pending", status: "pending_payment", vivaOrderCode: "1234567890" };
const context = () => ({ params: Promise.resolve({ orderId: pending.id }) });
const remove = () => DELETE(new Request("http://localhost/api/admin/orders/AUDIT-ONLY", { method: "DELETE" }), context());
const patch = (body: unknown) => PATCH(new Request("http://localhost/api/admin/orders/AUDIT-ONLY", { method: "PATCH", body: JSON.stringify(body) }), context());

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Audit prohibits network access"); }));
  mocks.deny.mockResolvedValue(null);
  mocks.getOrder.mockResolvedValue(pending);
  mocks.archive.mockResolvedValue({ ...pending, archivedAt: "2026-11-10T12:00:00Z" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Payment audit: administrative boundaries", () => {
  it("cancels the provider session before archiving a pending order", async () => {
    const response = await remove();
    expect(response.status).toBe(200);
    expect(mocks.archive).toHaveBeenCalledOnce();
    expect(mocks.cancelProvider).toHaveBeenCalledExactlyOnceWith({ config: { isConfigured: true }, orderCode: pending.vivaOrderCode });
    expect(mocks.cancelProvider.mock.invocationCallOrder[0]).toBeLessThan(mocks.archive.mock.invocationCallOrder[0]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not archive or release reservations when provider cancellation fails", async () => {
    mocks.cancelProvider.mockRejectedValue(new Error("provider rejected cancellation"));
    expect((await remove()).status).toBe(409);
    expect(mocks.archive).not.toHaveBeenCalled();
  });

  it("rejects removal of an already paid order before calling the provider", async () => {
    mocks.getOrder.mockResolvedValue({ ...pending, paymentState: "paid" });
    expect((await remove()).status).toBe(409);
    expect(mocks.cancelProvider).not.toHaveBeenCalled();
  });

  it("uses one atomic payment RPC and never falls back to direct updates on failure", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "inventory_insufficient_product" } });
    await expect(updateOrderPaymentStateInSupabase("AUDIT-ONLY", "paid")).rejects.toThrow("inventory_insufficient_product");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_admin_update_order", { p_order_id: "AUDIT-ONLY", p_patch: { payment_state: "paid" } });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("combines payment, status and tracking in a single database operation", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    await updateOrderAdminFieldsInSupabase("AUDIT-ONLY", { status: "processing", paymentState: "paid", trackingNumber: "  track  " });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_admin_update_order", {
      p_order_id: "AUDIT-ONLY", p_patch: { status: "processing", payment_state: "paid", tracking_number: "track" },
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("sends one combined admin update and withholds rewards for payment review", async () => {
    mocks.update.mockResolvedValue({ ...pending, paymentState: "paid", status: "paid", paymentReviewRequired: true });
    expect((await patch({ paymentState: "paid", status: "paid", trackingNumber: "tracking" })).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith(pending.id, { paymentState: "paid", status: "paid", trackingNumber: "tracking" });
    expect(mocks.invoice).toHaveBeenCalledOnce();
    expect(mocks.loyalty).not.toHaveBeenCalled();
  });

  it("returns a conflict without paid side effects for rejected database transitions", async () => {
    mocks.update.mockRejectedValue(new Error("order_transition_unpaid_fulfillment"));
    expect((await patch({ status: "shipped" })).status).toBe(409);
    expect(mocks.invoice).not.toHaveBeenCalled();
  });

  it.each([null, [], { paymentState: "not_configured" }, { status: "invented" }, { trackingNumber: 10 }])("rejects invalid payload %j before writing", async (payload) => {
    expect((await patch(payload)).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
