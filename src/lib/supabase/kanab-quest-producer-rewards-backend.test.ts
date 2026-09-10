import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: mocks.client }));

import {
  claimKqProducerHeritageForCustomer,
  previewKqProducerNotebookRewardBatch,
  syncKqProducerNotebookRewardsForReview,
} from "@/lib/supabase/kanab-quest-producer-rewards-backend";

describe("producer notebook reward backend", () => {
  it("awards the producer Heritage through the approved-review RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        flowerBoosterGranted: false,
        flowerBoostersGranted: 0,
        flowerBoostersTotal: 0,
        boosterCardCount: 0,
        heritageGranted: 1,
        heritageCodes: ["HERITAGE-001"],
      },
      error: null,
    });
    mocks.client.mockReturnValue({ rpc });
    await expect(syncKqProducerNotebookRewardsForReview({
      customerId: "11111111-1111-1111-1111-111111111111",
      reviewId: "22222222-2222-2222-2222-222222222222",
    })).resolves.toEqual({
      live: true,
      flowerBoosterGranted: false,
      flowerBoostersGranted: 0,
      flowerBoostersTotal: 0,
      boosterCardCount: 0,
      heritageGranted: 1,
      heritageCodes: ["HERITAGE-001"],
    });
    expect(rpc).toHaveBeenCalledWith("rpc_kq_grant_producer_notebook_rewards", {
      p_user_id: "11111111-1111-1111-1111-111111111111",
      p_review_id: "22222222-2222-2222-2222-222222222222",
    });
  });

  it("claims through the atomic server operation without accepting a card code", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { cardCode: "HERITAGE-001", alreadyGranted: false },
      error: null,
    });
    mocks.client.mockReturnValue({ rpc });
    await expect(claimKqProducerHeritageForCustomer({
      customerId: "11111111-1111-1111-1111-111111111111",
      campaignId: "22222222-2222-2222-2222-222222222222",
      entryId: "flower-1",
    })).resolves.toEqual({ cardCode: "HERITAGE-001", alreadyGranted: false });
    expect(rpc).toHaveBeenCalledWith("rpc_kq_claim_producer_heritage", {
      p_user_id: "11111111-1111-1111-1111-111111111111",
      p_campaign_id: "22222222-2222-2222-2222-222222222222",
      p_entry_id: "flower-1",
    });
  });

  it("rejects invalid identifiers before touching persistence", async () => {
    mocks.client.mockClear();
    await expect(claimKqProducerHeritageForCustomer({
      customerId: "invalid",
      campaignId: "22222222-2222-2222-2222-222222222222",
      entryId: "flower-1",
    })).rejects.toThrow("invalide");
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("previews missing packs and Heritage grants without calling an RPC", async () => {
    const rpc = vi.fn();
    mocks.client.mockReturnValue({
      rpc,
      from: vi.fn((table: string) => {
        if (table === "contest_reviews") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  order: vi.fn(() => ({
                    range: vi.fn().mockResolvedValue({
                      data: [
                        { id: "review-1", customer_id: "user-1", entry_id: "entry-1" },
                        { id: "review-2", customer_id: "user-1", entry_id: "entry-1" },
                      ],
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === "contest_entries") {
          return { select: vi.fn(() => ({ in: vi.fn().mockResolvedValue({
            data: [{ id: "entry-1", producer_id: "producer-1", track: "concours" }], error: null,
          }) })) };
        }
        if (table === "kq_producer_reward_campaigns") {
          return { select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({
            data: [{ id: "campaign-1", producer_id: "producer-1", heritage_code: "HERITAGE-001" }], error: null,
          }) })) };
        }
        if (table === "kq_producer_reward_entries") {
          return { select: vi.fn(() => ({ in: vi.fn().mockResolvedValue({
            data: [{ campaign_id: "campaign-1", entry_id: "entry-1" }], error: null,
          }) })) };
        }
        if (table === "kq_heritage_card_definitions") {
          return { select: vi.fn().mockResolvedValue({
            data: [{ code: "HERITAGE-001", is_active: true }], error: null,
          }) };
        }
        if (table === "kq_notebook_flower_reward_grants") {
          return { select: vi.fn(() => ({ in: vi.fn(() => ({ in: vi.fn().mockResolvedValue({
            data: [{ id: "flower-grant-1", user_id: "user-1", entry_id: "entry-1" }], error: null,
          }) })) })) };
        }
        if (table === "kq_notebook_flower_reward_packs") {
          return { select: vi.fn(() => ({ in: vi.fn().mockResolvedValue({
            data: [
              { flower_grant_id: "flower-grant-1", pack_index: 1 },
              { flower_grant_id: "flower-grant-1", pack_index: 2 },
            ],
            error: null,
          }) })) };
        }
        return { select: vi.fn(() => ({ in: vi.fn(() => ({ in: vi.fn().mockResolvedValue({
          data: [], error: null,
        }) })) })) };
      }),
    });

    await expect(previewKqProducerNotebookRewardBatch(0)).resolves.toEqual({
      live: true,
      processed: 2,
      eligibleReviews: 2,
      pendingFlowerBoosters: 3,
      pendingHeritages: 1,
      alreadyComplete: 1,
      nextCursor: null,
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});
