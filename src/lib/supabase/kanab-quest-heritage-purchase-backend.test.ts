import { describe, expect, it, vi } from "vitest";

const { createSupabaseServiceClient } = vi.hoisted(() => ({
  createSupabaseServiceClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createSupabaseServiceClient }));

import {
  awardKqHeritageForPaidOrder,
  awardKqHeritagePurchaseBatch,
  KQ_HERITAGE_RETRO_BATCH_SIZE,
  previewKqHeritagePurchaseBatch,
} from "@/lib/supabase/kanab-quest-heritage-purchase-backend";

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

  it("previews pending purchase units while writes remain dormant", async () => {
    const rpc = vi.fn();
    createSupabaseServiceClient.mockReturnValue({
      rpc,
      from: vi.fn((table: string) => {
        if (table === "order_items") {
          return {
            select: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({
                  data: [{ id: 10, order_id: "order-1", product_id: "flower-1", quantity: 2 }],
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "contest_entries") {
          return { select: vi.fn().mockResolvedValue({ data: [{ product_id: "flower-1" }], error: null }) };
        }
        if (table === "orders") {
          return {
            select: vi.fn(() => ({
              in: vi.fn().mockResolvedValue({
                data: [{
                  id: "order-1",
                  customer_id: "customer-1",
                  payment_state: "paid",
                  status: "paid",
                }],
                error: null,
              }),
            })),
          };
        }
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({
              data: [{ order_item_id: 10, unit_index: 1 }],
              error: null,
            }),
          })),
        };
      }),
    });
    await expect(previewKqHeritagePurchaseBatch(0)).resolves.toEqual({
      live: false,
      processedItems: 1,
      eligibleUnits: 2,
      pendingUnits: 1,
      alreadyAwarded: 1,
      nextCursor: null,
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});
