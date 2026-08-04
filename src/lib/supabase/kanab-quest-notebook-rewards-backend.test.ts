import { describe, expect, it, vi } from "vitest";

const { createSupabaseServiceClient } = vi.hoisted(() => ({
  createSupabaseServiceClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient }));

import { KQ_NOTEBOOK_RETRO_BATCH_SIZE, syncKqNotebookRewardBatch, syncKqNotebookRewardsForCustomer } from "@/lib/supabase/kanab-quest-notebook-rewards-backend";

describe("Kanab Quest notebook reward hook", () => {
  it("returns safely when no active mission rule exists", async () => {
    createSupabaseServiceClient.mockReturnValue({
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) })) })),
    });
    await expect(syncKqNotebookRewardsForCustomer("customer-production")).resolves.toEqual({
      live: true,
      eligibleBadges: 0,
      granted: 0,
      alreadyGranted: 0,
    });
    expect(createSupabaseServiceClient).toHaveBeenCalledOnce();
  });

  it("keeps an empty retro-attribution batch safe", async () => {
    createSupabaseServiceClient.mockReturnValue({
      from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) })) })),
    });
    expect(KQ_NOTEBOOK_RETRO_BATCH_SIZE).toBe(50);
    await expect(syncKqNotebookRewardBatch(120)).resolves.toEqual({
      live: true,
      processed: 0,
      granted: 0,
      alreadyGranted: 0,
      nextCursor: null,
    });
  });
});
