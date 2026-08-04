import { describe, expect, it, vi } from "vitest";

const { createSupabaseServiceClient } = vi.hoisted(() => ({
  createSupabaseServiceClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient }));

import { awardKqHeritageForPaidOrder, awardKqHeritagePurchaseBatch, KQ_HERITAGE_RETRO_BATCH_SIZE } from "@/lib/supabase/kanab-quest-heritage-purchase-backend";

describe("Kanab Quest Heritage purchase hook", () => {
  it("ignores an unpaid or unknown order without awarding a card", async () => {
    createSupabaseServiceClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "orders") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) })) })) };
        if (table === "order_items") return { select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) })) };
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      }),
    });
    await expect(awardKqHeritageForPaidOrder("order-production")).resolves.toEqual({
      live: true,
      planned: 0,
      awarded: 0,
      alreadyAwarded: 0,
    });
    expect(createSupabaseServiceClient).toHaveBeenCalledOnce();
  });

  it("handles an empty paginated retro-attribution batch", async () => {
    createSupabaseServiceClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "order_items") {
          return { select: vi.fn(() => ({
            order: vi.fn(() => ({ limit: vi.fn().mockResolvedValue({ data: [], error: null }) })),
          })) };
        }
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      }),
    });
    expect(KQ_HERITAGE_RETRO_BATCH_SIZE).toBe(25);
    await expect(awardKqHeritagePurchaseBatch(0)).resolves.toEqual({
      live: true,
      processedItems: 0,
      eligibleUnits: 0,
      awarded: 0,
      alreadyAwarded: 0,
      nextCursor: null,
    });
  });
});
