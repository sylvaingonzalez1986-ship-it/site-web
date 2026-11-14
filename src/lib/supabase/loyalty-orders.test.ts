import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildLoyaltySummaryWithBonus } from "@/lib/loyalty";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn<typeof fetch>() }));
vi.mock("./admin", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient("https://loyalty.test", "test-service-key", {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetchMock },
  });
  return { createSupabaseServiceClient: () => client };
});

import { readLoyaltyOrdersForCustomerFromSupabase } from "./loyalty-orders";

const userId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
type Row = {
  id: string; customer_id: string | null; legacy_customer_id: string | null;
  status: string; payment_state: string; total_amount: number | null;
  archived_at: string | null; payment_review_required: boolean;
};
const order = (id: string, overrides: Partial<Row> = {}): Row => ({
  id, customer_id: userId, legacy_customer_id: null, status: "paid", payment_state: "paid",
  total_amount: 1.25, archived_at: null, payment_review_required: false, ...overrides,
});
let rows: Row[];
let failingCursor: string | null;
let failures: number;
let denied: boolean;
const reads: Array<{ url: URL; signal?: AbortSignal | null }> = [];

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0);
  rows = []; reads.length = 0; failingCursor = null; failures = 0; denied = false;
  fetchMock.mockReset().mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    reads.push({ url, signal: init?.signal });
    expect(init?.method).toBe("GET");
    expect(url.pathname).toBe("/rest/v1/orders");
    expect(url.searchParams.get("select")).toBe("id,status,payment_state,total_amount");
    expect(url.searchParams.getAll("or")).toEqual([
      `(customer_id.eq.${userId},and(customer_id.is.null,legacy_customer_id.eq.${userId}))`,
      "(archived_at.is.null,and(payment_state.eq.paid,payment_review_required.eq.true))",
    ]);
    expect(url.searchParams.get("order")).toBe("id.asc");
    const cursor = url.searchParams.get("id");
    if (cursor === failingCursor) {
      if (denied) return Response.json({ message: "permission denied", code: "42501" }, { status: 403 });
      if (failures-- > 0) throw new TypeError("fetch failed");
    }
    const data = rows
      .filter(row => (row.customer_id ?? row.legacy_customer_id) === userId)
      .filter(row => row.archived_at === null || (row.payment_state === "paid" && row.payment_review_required))
      .filter(row => cursor === null || row.id > cursor.slice(3))
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, Math.min(1000, Number(url.searchParams.get("limit"))));
    return Response.json(data);
  });
});

afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("customer loyalty order reads", () => {
  it("reads more than 1000 customer orders regardless of other customers' order volume", async () => {
    rows = [
      ...Array.from({ length: 1003 }, (_, i) => order(`mine-${String(i).padStart(4, "0")}`)),
      ...Array.from({ length: 1200 }, (_, i) => order(`other-${i}`, { customer_id: otherId, total_amount: 900 })),
    ];
    const orders = await readLoyaltyOrdersForCustomerFromSupabase(userId);
    expect(orders).toHaveLength(1003);
    expect(buildLoyaltySummaryWithBonus(orders, 100, 200)).toMatchObject({
      totalEligibleSpend: 1253.75, basePoints: 1253, spendablePoints: 1153, eligibleOrdersCount: 1003,
    });
    expect(reads.map(read => read.url.searchParams.get("id"))).toEqual([null, "gt.mine-0499", "gt.mine-0999"]);
    expect(reads.every(read => read.signal instanceof AbortSignal)).toBe(true);
  });

  it("preserves ownership precedence, archive visibility, and paid/not-configured eligibility", async () => {
    rows = [
      order("canonical"), order("legacy", { customer_id: null, legacy_customer_id: userId }),
      order("other-owner", { customer_id: otherId, legacy_customer_id: userId, total_amount: 500 }),
      order("archived", { archived_at: "2026-01-01" }),
      order("archived-review", { archived_at: "2026-01-01", payment_review_required: true }),
      order("cancelled", { status: "cancelled" }), order("failed", { payment_state: "failed" }),
      order("not-configured", { payment_state: "not_configured" }),
    ];
    const orders = await readLoyaltyOrdersForCustomerFromSupabase(userId);
    expect(orders).toHaveLength(6);
    expect(buildLoyaltySummaryWithBonus(orders, 25, 5)).toMatchObject({
      basePoints: 5, spendablePoints: 25, totalEligibleSpend: 5, eligibleOrdersCount: 4,
    });
  });

  it("retries only the failed page and retains all confirmed points", async () => {
    rows = Array.from({ length: 501 }, (_, i) => order(`mine-${String(i).padStart(4, "0")}`));
    failingCursor = "gt.mine-0499"; failures = 1;
    const pending = readLoyaltyOrdersForCustomerFromSupabase(userId);
    await vi.advanceTimersByTimeAsync(500);
    expect(await pending).toHaveLength(501);
    expect(reads.map(read => read.url.searchParams.get("id"))).toEqual([null, "gt.mine-0499", "gt.mine-0499"]);
    expect(new Set(reads.map(read => read.signal)).size).toBe(3);
  });

  it("rejects a later permission failure instead of returning a partial point balance", async () => {
    rows = Array.from({ length: 501 }, (_, i) => order(`mine-${String(i).padStart(4, "0")}`));
    failingCursor = "gt.mine-0499"; denied = true;
    await expect(readLoyaltyOrdersForCustomerFromSupabase(userId)).rejects.toMatchObject({
      message: "[supabase:read customer loyalty orders] permission denied", attempts: 1,
    });
    expect(reads).toHaveLength(2);
  });

  it("keeps a missing amount unavailable instead of treating it as zero", async () => {
    rows = [order("missing-amount", { total_amount: null })];
    await expect(readLoyaltyOrdersForCustomerFromSupabase(userId)).rejects.toThrow("Montant de commande invalide");
  });

  it("returns an empty list only for a successful empty lookup", async () => {
    expect(await readLoyaltyOrdersForCustomerFromSupabase(userId)).toEqual([]);
    expect(reads).toHaveLength(1);
  });

  it("rejects an invalid identity before querying", async () => {
    await expect(readLoyaltyOrdersForCustomerFromSupabase("bad,customer_id.not.is.null")).rejects.toThrow("Identite client invalide");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
