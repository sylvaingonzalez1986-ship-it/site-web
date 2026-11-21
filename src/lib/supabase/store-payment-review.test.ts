import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => ({ from: mocks.from }) }));

import { readStoreFromSupabase } from "./store-backend";

beforeEach(() => vi.resetAllMocks());

describe("admin store payment review visibility", () => {
  it.each([
    { paymentState: "paid", reviewReason: "reward_claim_released_before_payment", archivedAt: null },
    { paymentState: "paid", reviewReason: null, archivedAt: null },
    { paymentState: "failed", reviewReason: "payment_after_cancellation", archivedAt: "2026-11-21T12:00:00.000Z" },
  ])("preserves review reason $reviewReason for a $paymentState order", async ({ paymentState, reviewReason, archivedAt }) => {
    const required = reviewReason !== null;
    const order = {
      id: "ORD-TEST",
      payment_state: paymentState,
      payment_provider: archivedAt ? "swiss_bitcoin_pay" : "viva",
      status: archivedAt ? "cancelled" : "paid",
      archived_at: archivedAt,
    };
    mocks.from.mockImplementation((table: string) => {
      const query = {
        data: (table === "orders" ? [order] : []) as Array<Record<string, unknown>>,
        error: null,
        select: vi.fn(), order: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), or: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      query.select.mockImplementation((columns: string) => {
        if (table === "orders" && columns === "id,payment_review_required,payment_review_reason") {
          query.data = [{ id: order.id, payment_review_required: required, payment_review_reason: reviewReason }];
        }
        return query;
      });
      return query;
    });

    const store = await readStoreFromSupabase();

    expect(store.orders).toHaveLength(1);
    expect(store.orders[0]).toMatchObject({
      id: order.id,
      paymentState,
      archivedAt: archivedAt ?? undefined,
      paymentReviewRequired: required,
      paymentReviewReason: reviewReason ?? undefined,
    });
    const orderQueries = mocks.from.mock.results.filter((result, index) => mocks.from.mock.calls[index][0] === "orders");
    expect(orderQueries[0].value.or).toHaveBeenCalledWith("archived_at.is.null,payment_review_required.eq.true");
  });
});
