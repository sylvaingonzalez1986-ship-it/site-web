import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseServiceClient: () => ({ rpc: mocks.rpc, from: mocks.from }),
}));

import { updateOrderPaymentByVivaOrderCodeInSupabase } from "./order-backend";

const input = {
  orderCode: "6810910170372602", paymentState: "failed" as const,
  transactionId: "b1a3067c-321b-4ec6-bc9d-1778aef2a19d",
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.from.mockImplementation((table: string) => {
    const chain = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: {
        id: "ORD-PAID", payment_state: "paid", status: "shipped", created_at: "2026-11-08T12:00:00Z",
        total_amount: 21.1, viva_order_code: input.orderCode, viva_transaction_id: "successful-transaction",
        payment_review_required: true, payment_review_reason: "reward_claim_released_before_payment",
      }, error: null }),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    if (table !== "orders" && table !== "order_items") throw new Error(`Unexpected table ${table}`);
    return chain;
  });
});

describe("Viva failed-payment adapter", () => {
  it("returns a paid no-op without applying inventory or any reward side effect", async () => {
    expect(await updateOrderPaymentByVivaOrderCodeInSupabase(input)).toMatchObject({
      paymentState: "paid", status: "shipped", vivaTransactionId: "successful-transaction",
      paymentReviewRequired: true, paymentReviewReason: "reward_claim_released_before_payment",
    });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("rpc_update_viva_payment", {
      p_viva_order_code: input.orderCode, p_payment_state: "failed", p_viva_transaction_id: input.transactionId,
    });
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual(["orders", "order_items"]);
  });

  it("propagates a missing migration without falling back or touching any order", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "rpc_update_viva_payment not found" } });

    await expect(updateOrderPaymentByVivaOrderCodeInSupabase(input)).rejects.toThrow("rpc_update_viva_payment not found");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls[0]?.[0]).toBe("rpc_update_viva_payment");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("keeps missing or archived orders absent without additional operations", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await updateOrderPaymentByVivaOrderCodeInSupabase(input)).toBeNull();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
