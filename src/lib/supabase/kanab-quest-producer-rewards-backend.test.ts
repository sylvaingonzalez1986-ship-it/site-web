import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient: mocks.client }));

import {
  claimKqProducerHeritageForCustomer,
  syncKqProducerNotebookRewardsForReview,
} from "@/lib/supabase/kanab-quest-producer-rewards-backend";

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
});
