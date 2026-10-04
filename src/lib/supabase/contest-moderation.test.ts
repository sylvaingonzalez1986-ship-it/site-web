import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContestReviewVersionConflictError } from "@/lib/contest-review-moderation";

const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: mocks.client }));
import { moderateContestReview } from "./contest-backend";

const originalVersion = "2026-10-04T10:00:00.123456+00:00";
function fixture(updatedAt: string) {
  const review: Record<string, unknown> = { id: "review", customer_id: "customer", updated_at: updatedAt, status: "pending", comment: "Dernière version" };
  const writes: Record<string, unknown>[] = [];
  const deletePoints = vi.fn().mockResolvedValue({ error: null });
  mocks.client.mockReturnValue({
    from: (table: string) => {
      if (table === "contest_tester_points") return { delete: () => ({ like: deletePoints }) };
      if (table !== "contest_reviews") throw new Error(`Unexpected table ${table}`);
      const filters: Array<[string, unknown]> = [];
      let patch: Record<string, unknown> | undefined;
      const query = {
        update: (value: Record<string, unknown>) => { patch = value; return query; },
        eq: (field: string, value: unknown) => { filters.push([field, value]); return query; },
        select: () => query,
        maybeSingle: async () => {
          if (!filters.every(([field, value]) => review[field] === value)) return { data: null, error: null };
          if (patch) { writes.push(patch); Object.assign(review, patch); }
          return { data: { ...review }, error: null };
        },
      };
      return query;
    },
  });
  return { review, writes, deletePoints };
}

beforeEach(() => vi.clearAllMocks());

describe("atomic moderation comparison", () => {
  it("does not publish content changed after the administrator loaded it", async () => {
    const state = fixture("2026-10-04T10:00:01.000000+00:00");
    await expect(moderateContestReview({ reviewId: "review", expectedUpdatedAt: originalVersion, status: "approved", reviewedBy: "admin@example.test" }))
      .rejects.toBeInstanceOf(ContestReviewVersionConflictError);
    expect(state.review.status).toBe("pending");
    expect(state.writes).toEqual([]);
    expect(state.deletePoints).not.toHaveBeenCalled();
  });

  it("moderates the exact version and then refuses a replay from the old screen", async () => {
    const state = fixture(originalVersion);
    const input = { reviewId: "review", expectedUpdatedAt: originalVersion, status: "rejected" as const, reviewedBy: "admin@example.test", adminNote: "Précise ton expérience." };
    await moderateContestReview(input);
    expect(state.review).toMatchObject({ status: "rejected", admin_note: input.adminNote, comment: "Dernière version" });
    expect(state.writes).toHaveLength(1);
    await expect(moderateContestReview(input)).rejects.toBeInstanceOf(ContestReviewVersionConflictError);
    expect(state.writes).toHaveLength(1);
  });
});
