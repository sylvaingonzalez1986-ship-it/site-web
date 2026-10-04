import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: mocks.client }));
import { getAdminContestReviews } from "./contest-backend";

describe("review timestamp precision", () => {
  it("preserves the database version and ordering timestamps through admin hydration", async () => {
    const timestamps = {
      created_at: "2026-10-04T12:34:56.123456+00:00",
      updated_at: "2026-10-04T14:35:57.654321+02:00",
      reviewed_at: "2026-10-04T12:35:58.987654+00:00",
    };
    const review = { id: "review", entry_id: "entry", season_id: "season", customer_id: "customer",
      pseudo_snapshot: "Testeur", status: "approved", consumption_method: "vaporizer", ...timestamps };
    mocks.client.mockReturnValue({
      from: (table: string) => {
        const response = { data: table === "contest_reviews" ? [review] : [], error: null, count: 1 };
        const query = {
          select: () => query,
          eq: () => query,
          in: () => query,
          order: () => query,
          range: () => query,
          then: (resolve: (value: typeof response) => unknown) => Promise.resolve(response).then(resolve),
        };
        return query;
      },
    });

    const result = await getAdminContestReviews();
    expect(result.items[0]).toMatchObject({
      createdAt: timestamps.created_at,
      updatedAt: timestamps.updated_at,
      reviewedAt: timestamps.reviewed_at,
    });
    // Millisecond conversion would change the SQL CAS and cursor boundaries.
    expect(result.items[0].updatedAt).not.toBe(new Date(timestamps.updated_at).toISOString());
  });
});
