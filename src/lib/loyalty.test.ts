import { describe, expect, it } from "vitest";

import { buildLoyaltySummary } from "@/lib/loyalty";
import type { CmsOrder } from "@/types/store";

function makeOrder(overrides: Partial<CmsOrder>): CmsOrder {
  return {
    id: "ord-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "paid",
    paymentProvider: "viva",
    paymentState: "paid",
    source: "web",
    itemsCount: 1,
    totalHt: 0,
    totalVat: 0,
    vatBreakdown: [],
    totalAmount: 0,
    items: [],
    ...overrides,
  };
}

describe("loyalty", () => {
  it("starts with zero points and no unlocked badge", () => {
    const summary = buildLoyaltySummary([]);

    expect(summary.points).toBe(0);
    expect(summary.currentBadge.id).toBe("decouverte");
    expect(summary.currentBadge.unlocked).toBe(false);
  });

  it("unlocks Bronze exactly at 100 points", () => {
    const summary = buildLoyaltySummary([makeOrder({ totalAmount: 100 })]);

    expect(summary.points).toBe(100);
    expect(summary.currentBadge.id).toBe("decouverte");
    expect(summary.currentBadge.unlocked).toBe(true);
    expect(summary.nextBadge?.id).toBe("explorateur");
  });

  it("unlocks Diamant at 2000 points", () => {
    const summary = buildLoyaltySummary([makeOrder({ totalAmount: 2000 })]);

    expect(summary.points).toBe(2000);
    expect(summary.currentBadge.id).toBe("legende");
    expect(summary.nextBadge).toBeNull();
    expect(summary.progressToNextBadge).toBe(100);
  });

  it("excludes cancelled and failed orders from points", () => {
    const summary = buildLoyaltySummary([
      makeOrder({ totalAmount: 250 }),
      makeOrder({ id: "cancelled", status: "cancelled", totalAmount: 1000 }),
      makeOrder({ id: "failed", paymentState: "failed", totalAmount: 1000 }),
    ]);

    expect(summary.points).toBe(250);
    expect(summary.eligibleOrdersCount).toBe(1);
    expect(summary.totalEligibleSpend).toBe(250);
  });
});
