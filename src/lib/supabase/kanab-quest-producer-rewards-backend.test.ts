import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: mocks.client }));

import { syncKqProducerNotebookRewardsForReview } from "@/lib/supabase/kanab-quest-producer-rewards-backend";

describe("producer notebook reward backend", () => {
  it("does not access persistence while the launch lock is closed", async () => {
    await expect(syncKqProducerNotebookRewardsForReview({
      customerId: "11111111-1111-1111-1111-111111111111",
      reviewId: "22222222-2222-2222-2222-222222222222",
    })).resolves.toEqual({
      live: false,
      flowerBoosterGranted: false,
      boosterCardCount: 0,
      heritageGranted: 0,
      heritageCodes: [],
    });
    expect(mocks.client).not.toHaveBeenCalled();
  });
});
