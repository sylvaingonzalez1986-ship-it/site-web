import "server-only";

import { createOrderId } from "@/lib/order-id";
import type { AppendOrderInput } from "@/lib/orders-types";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { readStoreFromSupabase } from "@/lib/supabase/store-backend";
import type { CmsOrder, OrderStatus } from "@/types/store";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function failIfError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`[supabase:${context}] ${error.message}`);
  }
}

async function findOrderById(orderId: string): Promise<CmsOrder | null> {
  const store = await readStoreFromSupabase();
  return store.orders.find((order) => order.id === orderId) ?? null;
}

async function findOrderByVivaOrderCode(orderCode: number): Promise<CmsOrder | null> {
  const store = await readStoreFromSupabase();
  return store.orders.find((order) => order.vivaOrderCode === orderCode) ?? null;
}

function computeNextStatusFromPaymentState(
  currentStatus: OrderStatus,
  paymentState: CmsOrder["paymentState"],
): OrderStatus {
  if (paymentState === "paid") {
    return currentStatus === "new" || currentStatus === "pending_payment"
      ? "paid"
      : currentStatus;
  }

  if (paymentState === "failed") {
    return currentStatus === "new" || currentStatus === "pending_payment"
      ? "pending_payment"
      : currentStatus;
  }

  if (paymentState === "not_configured") {
    return currentStatus === "new" || currentStatus === "pending_payment"
      ? "paid"
      : currentStatus;
  }

  return currentStatus === "paid" ? "pending_payment" : currentStatus;
}

type ApplyInventoryResult = {
  applied: boolean;
  reason?: string;
  processed_items?: number;
};

type ApplyLoyaltyBonusResult = {
  applied: boolean;
  reason?: string;
  bonus_points?: number;
};

async function applyOrderInventoryInSupabase(orderId: string): Promise<void> {
  const safeOrderId = orderId.trim();
  if (!safeOrderId) {
    return;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_apply_order_inventory", {
    p_order_id: safeOrderId,
  });

  if (result.error) {
    const message = result.error.message || "Echec application inventaire.";
    if (message.includes("order_not_found")) {
      throw new Error("Commande introuvable pour inventaire.");
    }
    if (message.includes("order_not_paid")) {
      throw new Error("Commande non payée : inventaire non appliqué.");
    }
    if (message.includes("inventory_insufficient_variant")) {
      throw new Error("Stock variante insuffisant.");
    }
    if (message.includes("inventory_insufficient_product")) {
      throw new Error("Stock produit insuffisant.");
    }

    throw new Error(`[supabase:rpc_apply_order_inventory] ${message}`);
  }

  const payload = result.data as ApplyInventoryResult | null;
  if (!payload) {
    return;
  }
}

export async function appendOrderToSupabase(input: AppendOrderInput): Promise<CmsOrder> {
  const supabase = createSupabaseServiceClient();
  const orderId = input.orderId?.trim() || createOrderId();
  const rawCustomerId = input.customer?.id?.trim() || null;
  const isUuidCustomerId = Boolean(rawCustomerId && UUID_PATTERN.test(rawCustomerId));

  const orderPayload = {
    id: orderId,
    created_at: new Date().toISOString(),
    status: input.status ?? "new",
    payment_provider: "viva",
    payment_state: input.paymentState,
    viva_order_code:
      input.viva && Number.isFinite(input.viva.orderCode) && input.viva.orderCode > 0
        ? Math.floor(input.viva.orderCode)
        : null,
    viva_transaction_id: input.viva?.transactionId?.trim() || null,
    customer_id: isUuidCustomerId ? rawCustomerId : null,
    legacy_customer_id: isUuidCustomerId ? null : rawCustomerId,
    customer_email: input.customer?.email?.trim() || null,
    customer_name: input.customer?.name?.trim() || null,
    shipping_address: input.shipping?.address?.trim() || null,
    shipping_city: input.shipping?.city?.trim() || null,
    shipping_postal_code: input.shipping?.postalCode?.trim() || null,
    shipping_country: input.shipping?.country?.trim() || null,
    shipping_phone: input.shipping?.phone?.trim() || null,
    delivery_method:
      input.shipping?.deliveryMethod === "relay" ? "relay" : "home",
    delivery_fee:
      Number.isFinite(Number(input.shipping?.deliveryFee)) && Number(input.shipping?.deliveryFee) >= 0
        ? Number(Number(input.shipping?.deliveryFee).toFixed(2))
        : 0,
    relay_provider: input.shipping?.relayProvider?.trim() || null,
    relay_id: input.shipping?.relayId?.trim() || null,
    relay_name: input.shipping?.relayName?.trim() || null,
    relay_address: input.shipping?.relayAddress?.trim() || null,
    relay_city: input.shipping?.relayCity?.trim() || null,
    relay_postal_code: input.shipping?.relayPostalCode?.trim() || null,
    relay_country: input.shipping?.relayCountry?.trim() || null,
    promo_code: input.promo?.code?.trim().toUpperCase() || null,
    discount_percent: input.promo?.discountPercent ?? null,
    discount_amount: input.promo?.discountAmount ?? null,
    items_count: input.itemsCount,
    total_ht: input.totalHt ?? null,
    total_vat: input.totalVat ?? null,
    vat_breakdown: input.vatBreakdown ?? [],
    total_amount: input.totalAmount,
  };

  const itemsPayload = input.items.map((item) => ({
    product_id: item.productId,
    name: item.name,
    unit_price: item.unitPrice,
    unit_price_ht: item.unitPriceHt ?? null,
    quantity: item.quantity,
    line_total: Number.isFinite(Number(item.lineTotal))
      ? Number(item.lineTotal)
      : Number((item.unitPrice * item.quantity).toFixed(2)),
    line_total_ht: item.lineTotalHt ?? null,
    line_vat_amount: item.lineVatAmount ?? null,
    vat_rate: item.vatRate ?? 20,
    bonus_points:
      Number.isFinite(Number(item.bonusPoints)) && Number(item.bonusPoints) >= 0
        ? Math.floor(Number(item.bonusPoints))
        : null,
    parent_pack_id: item.parentPackId ?? null,
    parent_pack_name: item.parentPackName ?? null,
  }));

  const shouldConsumePromoCode = input.promo?.consumeCode !== false;
  const promoPayload =
    shouldConsumePromoCode &&
    rawCustomerId &&
      UUID_PATTERN.test(rawCustomerId) &&
      input.promo?.code
      ? {
        customer_id: rawCustomerId,
        code: input.promo.code.trim().toUpperCase(),
      }
      : null;

  const { data: rpcOrderId, error } = await supabase.rpc("rpc_create_order", {
    p_order: orderPayload,
    p_items: itemsPayload,
    p_promo: promoPayload,
  });
  if (error) {
    if (error.message.includes("PROMO_NOT_AVAILABLE")) {
      throw new Error("Code promo invalide ou déjà utilisé.");
    }
    failIfError(error, "rpc_create_order");
  }

  const insertedOrderId = typeof rpcOrderId === "string" && rpcOrderId.trim()
    ? rpcOrderId
    : orderId;

  const created = await findOrderById(insertedOrderId);
  if (!created) {
    throw new Error("Commande créée mais introuvable après insertion Supabase.");
  }

  return created;
}

export async function updateOrderStatusInSupabase(
  orderId: string,
  status: OrderStatus,
): Promise<CmsOrder | null> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
  failIfError(error, "update order status");
  return findOrderById(orderId);
}

export async function updateOrderPaymentStateInSupabase(
  orderId: string,
  paymentState: CmsOrder["paymentState"],
): Promise<CmsOrder | null> {
  const supabase = createSupabaseServiceClient();

  const currentResult = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();
  failIfError(currentResult.error, "read current order status");

  if (!currentResult.data) {
    return null;
  }

  const currentStatus = (currentResult.data.status ?? "new") as OrderStatus;
  const nextStatus = computeNextStatusFromPaymentState(currentStatus, paymentState);

  const updateResult = await supabase
    .from("orders")
    .update({
      payment_state: paymentState,
      status: nextStatus,
    })
    .eq("id", orderId);

  failIfError(updateResult.error, "update order payment_state");

  if (paymentState === "paid") {
    await applyOrderInventoryInSupabase(orderId);
  }

  return findOrderById(orderId);
}

export async function updateOrderPaymentByVivaOrderCodeInSupabase(input: {
  orderCode: number;
  paymentState: "paid" | "failed";
  transactionId?: string;
}): Promise<CmsOrder | null> {
  if (!Number.isFinite(input.orderCode) || input.orderCode <= 0) {
    return null;
  }

  const safeOrderCode = Math.floor(input.orderCode);
  const supabase = createSupabaseServiceClient();
  const { data: wasUpdated, error } = await supabase.rpc("rpc_update_payment", {
    p_viva_order_code: safeOrderCode,
    p_payment_state: input.paymentState,
    p_viva_transaction_id: input.transactionId?.trim() || null,
  });

  failIfError(error, "rpc_update_payment");

  if (wasUpdated !== true) {
    return null;
  }
  const updatedOrder = await findOrderByVivaOrderCode(safeOrderCode);
  if (updatedOrder?.paymentState === "paid") {
    await applyOrderInventoryInSupabase(updatedOrder.id);
  }

  return updatedOrder;
}

export async function applyOrderLoyaltyBonusInSupabase(
  orderId: string,
): Promise<{ applied: boolean; reason?: string; bonusPoints: number }> {
  const safeOrderId = orderId.trim();
  if (!safeOrderId) {
    return { applied: false, reason: "missing_order_id", bonusPoints: 0 };
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase.rpc("rpc_apply_order_loyalty_bonus", {
    p_order_id: safeOrderId,
  });

  failIfError(result.error, "rpc_apply_order_loyalty_bonus");

  const payload = (result.data ?? null) as ApplyLoyaltyBonusResult | null;
  return {
    applied: payload?.applied === true,
    reason: payload?.reason,
    bonusPoints:
      Number.isFinite(Number(payload?.bonus_points))
        ? Math.max(0, Math.floor(Number(payload?.bonus_points)))
        : 0,
  };
}
