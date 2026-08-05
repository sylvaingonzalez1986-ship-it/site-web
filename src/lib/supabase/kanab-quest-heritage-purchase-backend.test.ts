import { describe, expect, it, vi } from "vitest";

const { createSupabaseServiceClient } = vi.hoisted(() => ({
  createSupabaseServiceClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient }));

import { awardKqHeritageForPaidOrder, awardKqHeritagePurchaseBatch, KQ_HERITAGE_RETRO_BATCH_SIZE } from "@/lib/supabase/kanab-quest-heritage-purchase-backend";

describe("Kanab Quest Heritage purchase hook", () => {
  it("does not award a card when an order is paid", async () => {
    await expect(awardKqHeritageForPaidOrder("order-production")).resolves.toEqual({
      live: false,
      planned: 0,
      awarded: 0,
      alreadyAwarded: 0,
    });
    expect(createSupabaseServiceClient).not.toHaveBeenCalled();
  });

  it("keeps purchase retro-attribution dormant", async () => {
    expect(KQ_HERITAGE_RETRO_BATCH_SIZE).toBe(25);
    await expect(awardKqHeritagePurchaseBatch(0)).resolves.toEqual({
      live: false,
      processedItems: 0,
      eligibleUnits: 0,
      awarded: 0,
      alreadyAwarded: 0,
      nextCursor: null,
    });
  });
});
