import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONTEST_SCORE_CRITERIA } from "@/types/contest";
import { getContestReviewAverage } from "@/lib/contest-ui";

const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: mocks.client }));
import { getContestEntryReviewsPage, getContestProductTastingSummaries } from "./contest-backend";

type Row = Record<string, unknown>;
type Result = { data: Row[] | Row | null; error: null };
const reviewId = (entryIndex: number, reviewIndex: number) => `${entryIndex.toString(16).padStart(8, "0")}-${reviewIndex.toString(16).padStart(4, "0")}-4000-8000-000000000000`;

function fixture(productCount: number, reviewCount: number) {
  const entries: Row[] = Array.from({ length: productCount }, (_, i) => ({
    id: `entry-${i}`, product_id: `product-${i}`, season_id: "season", producer_id: "producer",
    slug: `flower-${i}`, title: `Flower ${i}`, category: "outdoor", track: "regular", is_published: true,
    technical_sheet: {}, gallery_urls: [], created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  }));
  const reviews: Row[] = entries.flatMap((entry, entryIndex) => Array.from({ length: reviewCount }, (_, i) => ({
    id: reviewId(entryIndex, i), entry_id: entry.id, season_id: "season", customer_id: "private-customer",
    pseudo_snapshot: "PublicPseudo", status: "approved", comment: "A public review", consumption_method: "vaporizer",
    reviewed_at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(), created_at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
    admin_note: "private note", reviewed_by: "admin@example.test",
  })));
  const rows: Record<string, Row[]> = {
    contest_entries: entries,
    contest_reviews: reviews,
    contest_seasons: [{ id: "season", label: "2026", is_active: true, is_archived: false }],
    contest_review_scores: reviews.flatMap((review, index) => CONTEST_SCORE_CRITERIA.map((criterion, offset) => ({
      id: index * 10 + offset, review_id: review.id, criterion, score: 80,
    }))),
  };
  const scoreReads: string[][] = [];
  const rpcCalls: Record<string, unknown>[] = [];
  class Query {
    filters: ((row: Row) => boolean)[] = [];
    ordering: { column: string; ascending: boolean }[] = [];
    max = 1000;
    constructor(readonly table: string) {}
    select() { return this; }
    eq(column: string, value: unknown) { this.filters.push((row) => row[column] === value); return this; }
    in(column: string, values: string[]) {
      if (this.table === "contest_review_scores") scoreReads.push(values);
      this.filters.push((row) => values.includes(String(row[column]))); return this;
    }
    order(column: string, options: { ascending: boolean }) { this.ordering.push({ column, ascending: options.ascending }); return this; }
    limit(value: number) { this.max = Math.min(value, 1000); return this; }
    execute(single = false): Result {
      const values = (rows[this.table] ?? []).filter((row) => this.filters.every((test) => test(row))).sort((left, right) => {
        for (const { column, ascending } of this.ordering) {
          const delta = String(left[column]).localeCompare(String(right[column]));
          if (delta) return ascending ? delta : -delta;
        }
        return 0;
      }).slice(0, this.max);
      return { data: single ? values[0] ?? null : values, error: null };
    }
    maybeSingle() { return Promise.resolve(this.execute(true)); }
    then<T = Result, E = never>(resolve?: ((value: Result) => T | PromiseLike<T>) | null, reject?: ((reason: unknown) => E | PromiseLike<E>) | null) {
      return Promise.resolve(this.execute()).then(resolve, reject);
    }
  }
  const client = {
    from: (table: string) => new Query(table),
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      expect(name).toBe("rpc_contest_public_review_page");
      rpcCalls.push(args);
      const ids = args.p_entry_ids as string[];
      expect(ids.length).toBeLessThanOrEqual(20);
      const data = ids.flatMap((id) => {
        if (!entries.some((entry) => entry.id === id && entry.is_published)) return [];
        return reviews.filter((review) => review.entry_id === id && review.status === "approved")
          .sort((a, b) => String(b.reviewed_at ?? b.created_at).localeCompare(String(a.reviewed_at ?? a.created_at)) || String(b.id).localeCompare(String(a.id)))
          .filter((review) => !args.p_before_date || String(review.reviewed_at ?? review.created_at) < String(args.p_before_date) ||
            (String(review.reviewed_at ?? review.created_at) === args.p_before_date && String(review.id) < String(args.p_before_id)))
          .slice(0, Number(args.p_limit));
      });
      return { data: data.slice(0, 1000), error: null };
    }),
  };
  mocks.client.mockReturnValue(client);
  return { entries, reviews, rows, scoreReads, rpcCalls };
}

beforeEach(() => vi.clearAllMocks());

describe("public review reads", () => {
  it("selects recent reviews per product before hydration, beyond the global API score cap", async () => {
    const state = fixture(65, 30); // 1,950 reviews and 19,500 scores behind a 1,000-row API cap.
    const summaries = await getContestProductTastingSummaries(state.entries.map((entry) => String(entry.product_id)), 2);
    expect(summaries).toHaveLength(65);
    expect(state.rpcCalls).toHaveLength(4);
    for (const summary of summaries) {
      const entryIndex = Number(summary.entry.id.replace("entry-", ""));
      expect(summary.reviews.map((review) => review.id)).toEqual([reviewId(entryIndex, 29), reviewId(entryIndex, 28)]);
      expect(summary.nextReviewCursor).toBeTruthy();
      for (const review of summary.reviews) expect(getContestReviewAverage(review.scores)).toBe(80);
    }
    expect(state.scoreReads.flat()).toHaveLength(130);
    expect(Math.max(...state.scoreReads.map((ids) => ids.length))).toBeLessThanOrEqual(40);
    expect(state.scoreReads.flat().some((id) => id === reviewId(0, 27))).toBe(false);
  });

  it("pages beyond forty reviews without repeats when a newer review appears between requests", async () => {
    const state = fixture(1, 55);
    state.reviews[3].status = "rejected";
    const first = await getContestEntryReviewsPage("entry-0");
    expect(first?.reviews[0].id).toBe(reviewId(0, 54));
    const newReviewId = "ffffffff-ffff-ffff-ffff-ffffffffffff";
    state.reviews.push({ ...state.reviews[0], id: newReviewId, reviewed_at: "2026-02-01T00:00:00.000Z" });
    const ids = first!.reviews.map((review) => review.id);
    let cursor = first!.nextReviewCursor;
    while (cursor) {
      const page = await getContestEntryReviewsPage("entry-0", { cursor });
      ids.push(...page!.reviews.map((review) => review.id));
      cursor = page!.nextReviewCursor;
    }
    expect(ids).toHaveLength(54);
    expect(new Set(ids).size).toBe(54);
    expect(ids.at(-1)).toBe(reviewId(0, 0));
    expect(ids).not.toContain(newReviewId);
    expect(ids).not.toContain(reviewId(0, 3));
    state.entries[0].is_published = false;
    expect(await getContestEntryReviewsPage("entry-0")).toBeNull();
  });

  it("keeps PostgreSQL timestamp microseconds in the next-page cursor", async () => {
    const state = fixture(1, 3);
    state.reviews[0].reviewed_at = "2026-01-01T00:00:00.123456+00:00";
    state.reviews[1].reviewed_at = "2026-01-01T00:00:00.123457+00:00";
    state.reviews[2].reviewed_at = "2026-01-01T00:00:00.123457+00:00";
    const first = await getContestEntryReviewsPage("entry-0", { limit: 1 });
    expect(JSON.parse(first!.nextReviewCursor!).publishedAt).toBe("2026-01-01T00:00:00.123457+00:00");
    const second = await getContestEntryReviewsPage("entry-0", { limit: 1, cursor: first!.nextReviewCursor });
    const third = await getContestEntryReviewsPage("entry-0", { limit: 1, cursor: second!.nextReviewCursor });
    expect([first, second, third].flatMap((page) => page!.reviews.map((review) => review.id))).toEqual([reviewId(0, 2), reviewId(0, 1), reviewId(0, 0)]);
  });
});
