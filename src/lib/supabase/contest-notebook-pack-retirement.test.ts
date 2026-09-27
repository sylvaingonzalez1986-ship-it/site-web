import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServiceClient } = vi.hoisted(() => ({
  createSupabaseServiceClient: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient }));

import { claimContestBadgeReward, getContestProfileBadges } from "@/lib/supabase/contest-backend";

type Row = Record<string, unknown>;
type Result = { data: Row[] | Row | null; error: null };

function fixture({ badgeCode = "nez-divin", withReview = false } = {}) {
  const badge = { id: "stored-badge-id", code: badgeCode };
  const badgeInserts: Row[] = [];
  const rpc = vi.fn().mockResolvedValue({ data: 6, error: null });
  class Query implements PromiseLike<Result> {
    columns = "";
    action = "select";
    payload: Row = {};
    constructor(readonly table: string) {}
    select(columns: string) { this.columns = columns; return this; }
    eq() { return this; }
    in() { return this; }
    or() { return this; }
    order() { return this; }
    limit() { return this; }
    lte() { return this; }
    upsert(payload: Row) { this.action = "upsert"; this.payload = payload; return this; }
    insert(payload: Row) { this.action = "insert"; this.payload = payload; return this; }
    result(single = false): Result {
      let rows: Row[] = [];
      if (this.action === "insert" && this.table === "contest_profile_badges") {
        badgeInserts.push(this.payload);
      } else if (this.action === "select") {
        if (this.table === "contest_badges") rows = [badge];
        // Point synchronization has no additional reviews to process in this fixture.
        if (withReview && this.table === "contest_reviews" && this.columns !== "id") {
          rows = [{ id: "review", entry_id: "entry", season_id: "season", quality_mark: null }];
        }
        if (withReview && this.table === "contest_entries") {
          rows = [{ id: "entry", category: "indoor", track: "concours", technical_sheet: {
            dominantTerpenes: ["beta-myrcene", "limonene", "alpha-pinene"],
          } }];
        }
        if (withReview && this.table === "contest_review_terpene_guesses") {
          rows = ["beta-myrcene", "limonene", "alpha-pinene"].map(terpene => ({ review_id: "review", terpene }));
        }
      }
      return { data: single ? rows[0] ?? null : rows, error: null };
    }
    maybeSingle() { return Promise.resolve(this.result(true)); }
    then<TResult1 = Result, TResult2 = never>(
      onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
      return Promise.resolve(this.result()).then(onfulfilled, onrejected);
    }
  }
  const from = vi.fn((table: string) => new Query(table));
  createSupabaseServiceClient.mockReturnValue({ from, rpc });
  return { rpc, badgeInserts };
}

beforeEach(() => createSupabaseServiceClient.mockReset());

describe("retired tasting mission legacy packs", () => {
  it.each([
    "premier-carnet", "contest-badge-premier-carnet",
    "combo-aromatique", "contest-badge-combo-aromatique",
  ])("refuses %s before any synchronization or legacy claim", async badgeId => {
    await expect(claimContestBadgeReward({ customerId: "customer", badgeId })).rejects.toThrow("pas de recompense");
    expect(createSupabaseServiceClient).not.toHaveBeenCalled();
  });

  it.each(["premier-carnet", "combo-aromatique"])("also rejects %s when resolved through an alternate stored ID", async badgeCode => {
    const state = fixture({ badgeCode });
    await expect(claimContestBadgeReward({ customerId: "customer", badgeId: "stored-badge-id" })).rejects.toThrow("pas de recompense");
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("keeps the other legacy badge rewards claimable", async () => {
    const state = fixture();
    await expect(claimContestBadgeReward({ customerId: "customer", badgeId: "nez-divin" })).resolves.toEqual({
      badgeId: "stored-badge-id", grantedPacks: 6,
    });
    expect(state.rpc).toHaveBeenCalledExactlyOnceWith("rpc_claim_contest_badge_reward", {
      p_customer_id: "customer", p_badge_id: "stored-badge-id",
    });
  });

  it("continues awarding the distinctions with zero packs and leaves Nez Absolu unchanged", async () => {
    const state = fixture({ withReview: true });
    await getContestProfileBadges("customer", { syncRewards: true });
    const counts = Object.fromEntries(state.badgeInserts.map(row => [row.badge_id, row.reward_pack_count]));
    expect(counts).toMatchObject({
      "contest-badge-premier-carnet": 0,
      "contest-badge-combo-aromatique": 0,
      "contest-badge-nez-absolu": 3,
    });
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
