import { describe, expect, it, vi } from "vitest";

const { createSupabaseServiceClient } = vi.hoisted(() => ({
  createSupabaseServiceClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient }));

import {
  KQ_NOTEBOOK_RETRO_BATCH_SIZE,
  previewKqNotebookRewardBatch,
  syncKqNotebookRewardBatch,
  syncKqNotebookRewardsForCustomer,
} from "@/lib/supabase/kanab-quest-notebook-rewards-backend";

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

  it("previews pending and idempotent grants without calling an RPC", async () => {
    const rpc = vi.fn();
    createSupabaseServiceClient.mockReturnValue({
      rpc,
      from: vi.fn((table: string) => {
        if (table === "kq_notebook_reward_rules") {
          return { select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [{ badge_code: "first" }], error: null }) })) };
        }
        if (table === "contest_badges") {
          return { select: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: [{ id: "badge-1" }], error: null }) })) };
        }
        if (table === "contest_profile_badges") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      { id: 10, customer_id: "customer-a" },
                      { id: 11, customer_id: "customer-b" },
                    ],
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({ data: [{ profile_badge_id: 10 }], error: null }),
          })),
        };
      }),
    });
    await expect(previewKqNotebookRewardBatch(0)).resolves.toEqual({
      live: true,
      processed: 2,
      pending: 1,
      alreadyGranted: 1,
      nextCursor: null,
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});
