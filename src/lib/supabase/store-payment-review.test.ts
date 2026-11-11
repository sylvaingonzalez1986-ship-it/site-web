import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: () => ({ from: mocks.from }) }));

import { readStoreFromSupabase } from "./store-backend";

beforeEach(() => vi.resetAllMocks());

describe("admin store payment review visibility", () => {
  it.each([true, false])("preserves payment review state %s when loading the admin store", async (required) => {
    const reviewReason = required ? "reward_claim_released_before_payment" : null;
    mocks.from.mockImplementation((table: string) => {
      const query = {
        data: (table === "orders" ? [{ id: "ORD-TEST", payment_state: "paid", status: "paid" }] : []) as Array<Record<string, unknown>>,
        error: null,
        select: vi.fn(), order: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), or: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      query.select.mockImplementation((columns: string) => {
        if (table === "orders" && columns === "id,payment_review_required,payment_review_reason") {
          query.data = [{ id: "ORD-TEST", payment_review_required: required, payment_review_reason: reviewReason }];
        }
        return query;
      });
      return query;
    });

    const store = await readStoreFromSupabase();

    expect(store.orders).toHaveLength(1);
    expect(store.orders[0]).toMatchObject({
      id: "ORD-TEST", paymentState: "paid", paymentReviewRequired: required,
      paymentReviewReason: reviewReason ?? undefined,
    });
    const orderQueries = mocks.from.mock.results.filter((result, index) => mocks.from.mock.calls[index][0] === "orders");
    expect(orderQueries[0].value.or).toHaveBeenCalledWith("archived_at.is.null,and(payment_state.eq.paid,payment_review_required.eq.true)");
  });
});
