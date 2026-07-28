import "server-only";

import {
  buildKqHeritagePurchaseDrawPlan,
  KQ_HERITAGE_PURCHASE_DRAWS_LIVE,
} from "@/lib/kanab-quest-heritage-purchase";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";

export type KqHeritagePurchaseAwardResult = {
  live: boolean;
  planned: number;
  awarded: number;
  alreadyAwarded: number;
};

export const KQ_HERITAGE_RETRO_BATCH_SIZE = 25;

export type KqHeritageRetroAwardResult = {
  live: boolean;
  processedItems: number;
  eligibleUnits: number;
  awarded: number;
  alreadyAwarded: number;
  nextCursor: number | null;
};

export async function awardKqHeritageForPaidOrder(
  orderId: string,
): Promise<KqHeritagePurchaseAwardResult> {
  if (!KQ_HERITAGE_PURCHASE_DRAWS_LIVE) {
    return { live: false, planned: 0, awarded: 0, alreadyAwarded: 0 };
  }

  const supabase = createSupabaseServiceClient();
  const [orderResult, itemsResult, contestProductsResult] = await Promise.all([
    supabase.from("orders").select("customer_id,payment_state,status").eq("id", orderId).maybeSingle(),
    supabase.from("order_items").select("id,product_id,quantity").eq("order_id", orderId),
    supabase.from("contest_entries").select("product_id"),
  ]);
  if (orderResult.error) throw new Error(`[supabase:kq-heritage-order] ${orderResult.error.message}`);
  if (itemsResult.error) throw new Error(`[supabase:kq-heritage-items] ${itemsResult.error.message}`);
  if (contestProductsResult.error) throw new Error(`[supabase:kq-heritage-products] ${contestProductsResult.error.message}`);
  const order = orderResult.data;
  if (!order || order.payment_state !== "paid" || order.status === "cancelled" || !order.customer_id) {
    return { live: true, planned: 0, awarded: 0, alreadyAwarded: 0 };
  }

  const plan = buildKqHeritagePurchaseDrawPlan(
    (itemsResult.data ?? []).map((item) => ({
      id: Number(item.id),
      productId: String(item.product_id),
      quantity: Number(item.quantity),
    })),
    (contestProductsResult.data ?? []).map((entry) => String(entry.product_id)),
  );
  let awarded = 0;
  let alreadyAwarded = 0;
  for (const draw of plan) {
    const result = await supabase.rpc("rpc_kq_draw_heritage_for_purchase", {
      p_user_id: String(order.customer_id),
      p_order_item_id: draw.orderItemId,
      p_unit_index: draw.unitIndex,
    });
    if (result.error) throw new Error(`[supabase:rpc_kq_draw_heritage_for_purchase] ${result.error.message}`);
    const receipt = result.data as { alreadyDrawn?: boolean } | null;
    if (receipt?.alreadyDrawn) alreadyAwarded += 1;
    else awarded += 1;
  }
  return { live: true, planned: plan.length, awarded, alreadyAwarded };
}

export async function awardKqHeritagePurchaseBatch(
  afterOrderItemId = 0,
): Promise<KqHeritageRetroAwardResult> {
  if (!KQ_HERITAGE_PURCHASE_DRAWS_LIVE) {
    return {
      live: false, processedItems: 0, eligibleUnits: 0, awarded: 0, alreadyAwarded: 0, nextCursor: null,
    };
  }
  const cursor = Number.isSafeInteger(afterOrderItemId) && afterOrderItemId >= 0 ? afterOrderItemId : 0;
  const supabase = createSupabaseServiceClient();
  let itemsQuery = supabase.from("order_items")
    .select("id,order_id,product_id,quantity")
    .order("id", { ascending: true })
    .limit(KQ_HERITAGE_RETRO_BATCH_SIZE);
  if (cursor > 0) itemsQuery = itemsQuery.gt("id", cursor);
  const [itemsResult, contestProductsResult] = await Promise.all([
    itemsQuery,
    supabase.from("contest_entries").select("product_id"),
  ]);
  if (itemsResult.error) throw new Error(`[supabase:kq-heritage-retro-items] ${itemsResult.error.message}`);
  if (contestProductsResult.error) throw new Error(`[supabase:kq-heritage-retro-products] ${contestProductsResult.error.message}`);
  const items = itemsResult.data ?? [];
  const orderIds = [...new Set(items.map((item) => String(item.order_id)).filter(Boolean))];
  const ordersResult = orderIds.length > 0
    ? await supabase.from("orders").select("id,customer_id,payment_state,status").in("id", orderIds)
    : { data: [], error: null };
  if (ordersResult.error) throw new Error(`[supabase:kq-heritage-retro-orders] ${ordersResult.error.message}`);
  const paidOrders = new Map((ordersResult.data ?? [])
    .filter((order) => order.payment_state === "paid" && order.status !== "cancelled" && order.customer_id)
    .map((order) => [String(order.id), String(order.customer_id)]));
  const planByOwner = items.flatMap((item) => {
    const userId = paidOrders.get(String(item.order_id));
    if (!userId) return [];
    return buildKqHeritagePurchaseDrawPlan([{
      id: Number(item.id),
      productId: String(item.product_id),
      quantity: Number(item.quantity),
    }], (contestProductsResult.data ?? []).map((entry) => String(entry.product_id)))
      .map((draw) => ({ ...draw, userId }));
  });
  let awarded = 0;
  let alreadyAwarded = 0;
  for (const draw of planByOwner) {
    const result = await supabase.rpc("rpc_kq_draw_heritage_for_purchase", {
      p_user_id: draw.userId,
      p_order_item_id: draw.orderItemId,
      p_unit_index: draw.unitIndex,
    });
    if (result.error) throw new Error(`[supabase:rpc_kq_draw_heritage_for_purchase] ${result.error.message}`);
    if ((result.data as { alreadyDrawn?: boolean } | null)?.alreadyDrawn) alreadyAwarded += 1;
    else awarded += 1;
  }
  const lastId = items.at(-1)?.id;
  return {
    live: true,
    processedItems: items.length,
    eligibleUnits: planByOwner.length,
    awarded,
    alreadyAwarded,
    nextCursor: items.length === KQ_HERITAGE_RETRO_BATCH_SIZE && lastId != null ? Number(lastId) : null,
  };
}
