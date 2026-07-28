import { describe, expect, it, vi } from "vitest";

const { createSupabaseServiceClient } = vi.hoisted(() => ({
  createSupabaseServiceClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient }));

import { KQ_NOTEBOOK_RETRO_BATCH_SIZE, syncKqNotebookRewardBatch, syncKqNotebookRewardsForCustomer } from "@/lib/supabase/kanab-quest-notebook-rewards-backend";

describe("dormant Kanab Quest notebook reward hook", () => {
  it("does not touch Supabase while notebook rewards are dormant", async () => {
    await expect(syncKqNotebookRewardsForCustomer("customer-production")).resolves.toEqual({
      live: false,
      eligibleBadges: 0,
      granted: 0,
      alreadyGranted: 0,
    });
    expect(createSupabaseServiceClient).not.toHaveBeenCalled();
  });

  it("keeps the paginated retro-attribution dormant too", async () => {
    expect(KQ_NOTEBOOK_RETRO_BATCH_SIZE).toBe(50);
    await expect(syncKqNotebookRewardBatch(120)).resolves.toEqual({
      live: false,
      processed: 0,
      granted: 0,
      alreadyGranted: 0,
      nextCursor: null,
    });
    expect(createSupabaseServiceClient).not.toHaveBeenCalled();
  });
});
