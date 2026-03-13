import { describe, expect, it } from "vitest";
import { canArchiveIncompleteOrder, isOrderArchived } from "@/lib/order-lifecycle";
import type { CmsOrder } from "@/types/store";

function makeOrder(overrides: Partial<CmsOrder> = {}): CmsOrder {
  return {
    id: "ORD-TEST",
    createdAt: "2026-03-13T12:00:00.000Z",
    status: "pending_payment",
    paymentProvider: "viva",
    paymentState: "pending",
    source: "web",
    itemsCount: 1,
    totalHt: 10,
    totalVat: 2,
    vatBreakdown: [],
    totalAmount: 12,
    items: [],
    ...overrides,
  };
}

describe("order lifecycle helpers", () => {
  it("detects archived orders", () => {
    expect(isOrderArchived(makeOrder())).toBe(false);
    expect(isOrderArchived(makeOrder({ archivedAt: "2026-03-13T12:10:00.000Z" }))).toBe(true);
  });

  it("allows archiving incomplete orders only", () => {
    expect(canArchiveIncompleteOrder(makeOrder())).toBe(true);
    expect(canArchiveIncompleteOrder(makeOrder({ paymentState: "failed", status: "cancelled" }))).toBe(true);
    expect(canArchiveIncompleteOrder(makeOrder({ paymentState: "paid", status: "paid" }))).toBe(false);
    expect(canArchiveIncompleteOrder(makeOrder({ paymentState: "not_configured" }))).toBe(false);
    expect(canArchiveIncompleteOrder(makeOrder({ status: "processing" }))).toBe(false);
    expect(
      canArchiveIncompleteOrder(makeOrder({ archivedAt: "2026-03-13T12:10:00.000Z" })),
    ).toBe(false);
  });
});
