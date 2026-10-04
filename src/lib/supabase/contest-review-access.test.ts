import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONTEST_SCORE_CRITERIA, type ContestReviewSubmissionInput } from "@/types/contest";

const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: mocks.client }));

import { submitContestReview, updateContestReview } from "@/lib/supabase/contest-backend";
import { ContestReviewVersionConflictError } from "@/lib/contest-review-moderation";

type Row = Record<string, unknown>;
type Result = { data: unknown; error: null };
const input: ContestReviewSubmissionInput = {
  entryId: "entry", consumptionMethod: "vaporizer", comment: "Une degustation corrigee.",
  expectedUpdatedAt: "2026-10-04T12:34:56.123456+00:00",
  consumptionDetails: "", aromaTags: [], terpeneGuesses: [],
  scores: Object.fromEntries(CONTEST_SCORE_CRITERIA.map(criterion => [criterion, 75])) as ContestReviewSubmissionInput["scores"],
};

function fixture({ status = "rejected", purchased = true, owner = "customer", guest = false } = {}) {
  const review: Row = { id: "review", entry_id: "entry", season_id: "season", customer_id: owner,
    pseudo_snapshot: "Testeur", status, comment: "Ancienne version", admin_note: "A corriger", quality_mark: "", consumption_method: "vaporizer" };
  const rows: Record<string, Row[]> = {
    contest_entries: [{ id: "entry", product_id: "flower", season_id: "season", title: "Fleur", slug: "fleur", category: "outdoor", track: "regular", is_published: true, technical_sheet: {} }],
    contest_profiles: [{ customer_id: "customer", pseudo: "Testeur" }],
    contest_reviews: status === "missing" ? [] : [review],
    orders: purchased && !guest ? [{ id: "order", customer_id: "customer", payment_state: "paid", status: "completed", created_at: "2026-01-01" }] : [],
    order_items: purchased ? [{ order_id: "order", product_id: "flower::5g" }] : [],
  };
  class Query implements PromiseLike<Result> {
    filters: Array<(row: Row) => boolean> = [];
    constructor(readonly table: string) {}
    select() { return this; }
    order() { return this; }
    limit() { return this; }
    eq(key: string, value: unknown) { this.filters.push(row => row[key] === value); return this; }
    neq(key: string, value: unknown) { this.filters.push(row => row[key] !== value); return this; }
    in(key: string, values: unknown[]) { this.filters.push(row => values.includes(row[key])); return this; }
    result(single = false): Result {
      const matching = (rows[this.table] ?? []).filter(row => this.filters.every(filter => filter(row)));
      return { data: single ? matching[0] ?? null : matching, error: null };
    }
    maybeSingle() { return Promise.resolve(this.result(true)); }
    then<TResult1 = Result, TResult2 = never>(onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> {
      return Promise.resolve(this.result()).then(onfulfilled, onrejected);
    }
  }
  const rpc = vi.fn(async (name: string): Promise<{ data: unknown; error: { message: string } | null }> => {
    if (name === "rpc_get_contest_paid_guest_orders") {
      return { data: purchased && guest ? [{ id: "order", created_at: "2026-01-01" }] : [], error: null };
    }
    Object.assign(review, { customer_id: "customer", status: "pending", admin_note: "", comment: input.comment });
    rows.contest_reviews = [review];
    return { data: "review", error: null };
  });
  mocks.client.mockReturnValue({ from: (table: string) => new Query(table), rpc });
  return { rpc };
}

beforeEach(() => vi.clearAllMocks());

describe("tasting review corrections", () => {
  it.each(["pending", "rejected"])("submits the owner's %s review through the atomic update", async status => {
    const state = fixture({ status });
    const review = await updateContestReview({ customerId: "customer", payload: input });
    expect(review).toMatchObject({ status: "pending", comment: input.comment, adminNote: "" });
    expect(state.rpc).toHaveBeenCalledWith("rpc_update_contest_review_atomic", expect.objectContaining({
      p_review_id: "review", p_customer_id: "customer", p_expected_updated_at: input.expectedUpdatedAt,
    }));
  });

  it("requires the version loaded by the customer", async () => {
    const state = fixture();
    await expect(updateContestReview({ customerId: "customer", payload: { ...input, expectedUpdatedAt: undefined } })).rejects.toThrow("Recharge l’avis");
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("reports a concurrent edit as a conflict without overwriting it", async () => {
    const state = fixture();
    state.rpc.mockResolvedValueOnce({ data: null, error: { message: "contest_review_version_conflict" } });
    await expect(updateContestReview({ customerId: "customer", payload: input })).rejects.toBeInstanceOf(ContestReviewVersionConflictError);
    expect(state.rpc).toHaveBeenCalledOnce();
  });

  it("still refuses rejected reviews without an eligible purchase", async () => {
    const state = fixture({ purchased: false });
    await expect(updateContestReview({ customerId: "customer", payload: input })).rejects.toThrow("Achat requis");
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("still refuses another customer's review", async () => {
    const state = fixture({ owner: "other-customer" });
    await expect(updateContestReview({ customerId: "customer", payload: input })).rejects.toThrow("Aucun avis");
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("keeps approved reviews immutable", async () => {
    const state = fixture({ status: "approved" });
    await expect(updateContestReview({ customerId: "customer", payload: input })).rejects.toThrow("deja approuves");
    expect(state.rpc).not.toHaveBeenCalled();
  });
});

describe("exact guest purchase lookup", () => {
  it.each(["a_ice@example.com", "%@example.com", "a*ice@example.com", " ALICE@Example.com "])("passes %s as literal data to the exact SQL lookup", async email => {
    const state = fixture({ status: "missing", guest: true });
    await submitContestReview({ customerId: "customer", customerEmail: email, payload: input });
    expect(state.rpc).toHaveBeenCalledWith("rpc_get_contest_paid_guest_orders", { p_email: email.trim().toLowerCase(), p_limit: 200 });
    expect(state.rpc).toHaveBeenCalledWith("rpc_create_contest_review_atomic", expect.objectContaining({
      p_customer_id: "customer", p_entry_id: "entry", p_season_id: "season", p_expected_product_id: "flower",
    }));
  });

  it("denies publication when the exact guest lookup finds no purchase", async () => {
    const state = fixture({ status: "missing", guest: true, purchased: false });
    await expect(submitContestReview({ customerId: "customer", customerEmail: "a_ice@example.com", payload: input })).rejects.toThrow("Achat requis");
    expect(state.rpc).toHaveBeenCalledExactlyOnceWith("rpc_get_contest_paid_guest_orders", { p_email: "a_ice@example.com", p_limit: 200 });
  });
});
