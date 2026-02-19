import "server-only";

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

function createOrderId(): string {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `ORD-${y}${m}${d}-${random}`;
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

export async function appendOrderToSupabase(input: AppendOrderInput): Promise<CmsOrder> {
  const supabase = createSupabaseServiceClient();
  const orderId = createOrderId();
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
    parent_pack_id: item.parentPackId ?? null,
    parent_pack_name: item.parentPackName ?? null,
  }));

  const promoPayload =
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
      throw new Error("Code promo invalide ou deja utilise.");
    }
    failIfError(error, "rpc_create_order");
  }

  const insertedOrderId = typeof rpcOrderId === "string" && rpcOrderId.trim()
    ? rpcOrderId
    : orderId;

  const created = await findOrderById(insertedOrderId);
  if (!created) {
    throw new Error("Commande creee mais introuvable apres insertion Supabase.");
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

  return findOrderByVivaOrderCode(safeOrderCode);
}
