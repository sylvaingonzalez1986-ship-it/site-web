import "server-only";

import { createOrderId } from "@/lib/order-id";
import type { AppendOrderInput } from "@/lib/orders-types";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { awardKqHeritageForPaidOrder } from "@/lib/supabase/kanab-quest-heritage-purchase-backend";
import type { CmsOrder, OrderItem, OrderStatus } from "@/types/store";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SELECT_ORDERS_COLUMNS = [
  "id",
  "created_at",
  "status",
  "payment_state",
  "archived_at",
  "archived_reason",
  "viva_order_code",
  "viva_transaction_id",
  "customer_id",
  "legacy_customer_id",
  "customer_email",
  "customer_name",
  "shipping_address",
  "shipping_city",
  "shipping_postal_code",
  "shipping_country",
  "shipping_phone",
  "delivery_method",
  "delivery_fee",
  "relay_id",
  "relay_name",
  "relay_address",
  "relay_postal_code",
  "relay_city",
  "relay_country",
  "tracking_number",
  "promo_code",
  "discount_percent",
  "discount_amount",
  "loyalty_badge_id",
  "extra_lottery_tickets",
  "items_count",
  "total_ht",
  "total_vat",
  "vat_breakdown",
  "total_amount",
].join(",");

const SELECT_ORDER_ITEMS_COLUMNS = [
  "order_id",
  "product_id",
  "name",
  "unit_price",
  "unit_price_ht",
  "quantity",
  "line_total",
  "line_total_ht",
  "line_vat_amount",
  "vat_rate",
  "bonus_points",
  "parent_pack_id",
  "parent_pack_name",
].join(",");

function failIfError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`[supabase:${context}] ${error.message}`);
  }
}

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toOptionalText(value: unknown): string | undefined {
  const text = toText(value).trim();
  return text ? text : undefined;
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toIsoString(value: unknown): string {
  const text = toText(value);
  if (!text) {
    return new Date().toISOString();
  }

  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) {
    return new Date().toISOString();
  }

  return new Date(parsed).toISOString();
}

function toOrderStatus(value: unknown): OrderStatus {
  const status = toText(value);
  if (
    status === "new" ||
    status === "pending_payment" ||
    status === "paid" ||
    status === "processing" ||
    status === "shipped" ||
    status === "cancelled"
  ) {
    return status;
  }

  return "new";
}

function toPaymentState(value: unknown): CmsOrder["paymentState"] {
  const paymentState = toText(value);
  if (
    paymentState === "pending" ||
    paymentState === "paid" ||
    paymentState === "failed" ||
    paymentState === "not_configured"
  ) {
    return paymentState;
  }

  return "pending";
}

function mapOrderRowForLoyalty(row: Record<string, unknown>): CmsOrder {
  return {
    id: toText(row.id),
    createdAt: toIsoString(row.created_at),
    status: toOrderStatus(row.status),
    paymentProvider: "viva",
    paymentState: toPaymentState(row.payment_state),
    archivedAt: toOptionalText(row.archived_at),
    archivedReason: toOptionalText(row.archived_reason),
    vivaOrderCode:
      Number.isFinite(Number(row.viva_order_code)) && Number(row.viva_order_code) > 0
        ? Math.floor(Number(row.viva_order_code))
        : undefined,
    vivaTransactionId: toOptionalText(row.viva_transaction_id),
    source: "web",
    customerId: toOptionalText(row.customer_id) ?? toOptionalText(row.legacy_customer_id),
    customerEmail: toOptionalText(row.customer_email),
    customerName: toOptionalText(row.customer_name),
    shippingAddress: toOptionalText(row.shipping_address),
    shippingCity: toOptionalText(row.shipping_city),
    shippingPostalCode: toOptionalText(row.shipping_postal_code),
    shippingCountry: toOptionalText(row.shipping_country),
    shippingPhone: toOptionalText(row.shipping_phone),
    deliveryMethod: row.delivery_method === "relay" ? "relay" : "home",
    deliveryFee: Math.max(0, toNumber(row.delivery_fee, 0)),
    relayId: toOptionalText(row.relay_id),
    relayName: toOptionalText(row.relay_name),
    relayAddress: toOptionalText(row.relay_address),
    relayPostalCode: toOptionalText(row.relay_postal_code),
    relayCity: toOptionalText(row.relay_city),
    relayCountry: toOptionalText(row.relay_country),
    trackingNumber: toOptionalText(row.tracking_number),
    promoCode: toOptionalText(row.promo_code),
    discountPercent: Math.max(0, toNumber(row.discount_percent, 0)),
    discountAmount: Math.max(0, toNumber(row.discount_amount, 0)),
    loyaltyBadgeId: toOptionalText(row.loyalty_badge_id),
    extraLotteryTickets: Math.max(0, Math.floor(toNumber(row.extra_lottery_tickets, 0))),
    itemsCount: Math.max(0, Math.floor(toNumber(row.items_count, 0))),
    totalHt: Math.max(0, toNumber(row.total_ht, 0)),
    totalVat: Math.max(0, toNumber(row.total_vat, 0)),
    vatBreakdown: Array.isArray(row.vat_breakdown) ? (row.vat_breakdown as CmsOrder["vatBreakdown"]) : [],
    totalAmount: Math.max(0, toNumber(row.total_amount, 0)),
    items: [],
  };
}

function mapOrderItemRow(row: Record<string, unknown>): OrderItem {
  return {
    productId: toText(row.product_id) || "unknown",
    name: toText(row.name) || "Produit",
    unitPrice: Number(toNumber(row.unit_price, 0).toFixed(4)),
    unitPriceHt: Number(toNumber(row.unit_price_ht, 0).toFixed(2)),
    quantity: Math.max(1, Math.floor(toNumber(row.quantity, 1))),
    lineTotal: Number(toNumber(row.line_total, 0).toFixed(2)),
    lineTotalHt: Number(toNumber(row.line_total_ht, 0).toFixed(2)),
    lineVatAmount: Number(toNumber(row.line_vat_amount, 0).toFixed(2)),
    vatRate: Math.max(0, toNumber(row.vat_rate, 20)) as OrderItem["vatRate"],
    bonusPoints:
      Number.isFinite(Number(row.bonus_points)) && Number(row.bonus_points) >= 0
        ? Math.floor(Number(row.bonus_points))
        : undefined,
    parentPackId: toOptionalText(row.parent_pack_id),
    parentPackName: toOptionalText(row.parent_pack_name),
  };
}

async function getOrderItemsByOrderId(orderId: string): Promise<OrderItem[]> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("order_items")
    .select(SELECT_ORDER_ITEMS_COLUMNS)
    .eq("order_id", orderId)
    .order("id", { ascending: true });
  failIfError(result.error, "read order_items for order");

  return (result.data ?? []).map((row) =>
    mapOrderItemRow(row as unknown as Record<string, unknown>),
  );
}

async function getOrderByFilterFromSupabase(input: {
  orderId?: string;
  vivaOrderCode?: string | number;
}): Promise<CmsOrder | null> {
  const supabase = createSupabaseServiceClient();
  let query = supabase.from("orders").select(SELECT_ORDERS_COLUMNS);

  if (input.orderId) {
    query = query.eq("id", input.orderId);
  }

  const vivaOrderCode = normalizeVivaOrderCode(input.vivaOrderCode);
  if (vivaOrderCode) {
    query = query.eq("viva_order_code", vivaOrderCode);
  }

  const orderResult = await query.maybeSingle();
  failIfError(orderResult.error, "read order by filter");

  if (!orderResult.data) {
    return null;
  }

  const row = orderResult.data as unknown as Record<string, unknown>;
  const order = mapOrderRowForLoyalty(row);
  const items = await getOrderItemsByOrderId(order.id);

  return {
    ...order,
    items,
    itemsCount: Number.isFinite(Number(row.items_count))
      ? Math.max(0, Math.floor(Number(row.items_count)))
      : items.reduce((acc, item) => acc + item.quantity, 0),
    totalAmount: Number(toNumber(row.total_amount, items.reduce((acc, item) => acc + item.lineTotal, 0)).toFixed(2)),
  };
}

async function findOrderById(orderId: string): Promise<CmsOrder | null> {
  const safeOrderId = orderId.trim();
  if (!safeOrderId) {
    return null;
  }

  return getOrderByFilterFromSupabase({ orderId: safeOrderId });
}

export async function getOrderByIdInSupabase(orderId: string): Promise<CmsOrder | null> {
  return findOrderById(orderId);
}

function normalizeVivaOrderCode(value: string | number | undefined): string | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }

    return String(Math.floor(value));
  }

  const text = value?.trim() ?? "";
  if (!/^\d{1,32}$/.test(text)) {
    return null;
  }

  return text.replace(/^0+(?=\d)/, "");
}

export async function getOrderByVivaOrderCodeInSupabase(
  orderCode: string | number,
): Promise<CmsOrder | null> {
  const safeOrderCode = normalizeVivaOrderCode(orderCode);
  if (!safeOrderCode) {
    return null;
  }

  return getOrderByFilterFromSupabase({ vivaOrderCode: safeOrderCode });
}

export async function listCustomerOrdersForLoyaltyInSupabase(input: {
  customerId: string;
  customerEmail?: string;
}): Promise<CmsOrder[]> {
  const safeCustomerId = input.customerId.trim();
  const safeCustomerEmail = (input.customerEmail ?? "").trim().toLowerCase();
  if (!safeCustomerId || !UUID_PATTERN.test(safeCustomerId)) {
    return [];
  }

  const supabase = createSupabaseServiceClient();
  const byCustomerIdPromise = supabase
    .from("orders")
    .select(SELECT_ORDERS_COLUMNS)
    .eq("customer_id", safeCustomerId)
    .order("created_at", { ascending: false });

  const byEmailPromise = safeCustomerEmail
    ? supabase
        .from("orders")
      .select(SELECT_ORDERS_COLUMNS)
        .is("customer_id", null)
        .ilike("customer_email", safeCustomerEmail)
        .order("created_at", { ascending: false })
    : Promise.resolve({ data: [], error: null } as {
        data: Array<Record<string, unknown>>;
        error: { message: string } | null;
      });

  const [byCustomerIdResult, byEmailResult] = await Promise.all([
    byCustomerIdPromise,
    byEmailPromise,
  ]);

  failIfError(byCustomerIdResult.error, "list customer orders by customer_id");
  failIfError(byEmailResult.error, "list customer orders by email");

  const rows = [...(byCustomerIdResult.data ?? []), ...(byEmailResult.data ?? [])].map(
    (row) => row as unknown as Record<string, unknown>,
  );
  const seenIds = new Set<string>();
  const orders: CmsOrder[] = [];

  for (const row of rows) {
    const id = toText(row.id);
    if (!id || seenIds.has(id)) {
      continue;
    }

    seenIds.add(id);
    orders.push(mapOrderRowForLoyalty(row));
  }

  return orders;
}

async function findOrderByVivaOrderCode(orderCode: string | number): Promise<CmsOrder | null> {
  const safeOrderCode = normalizeVivaOrderCode(orderCode);
  if (!safeOrderCode) {
    return null;
  }

  return getOrderByFilterFromSupabase({ vivaOrderCode: safeOrderCode });
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
    loyalty_badge_id: input.loyaltySnapshot?.badgeId?.trim() || null,
    extra_lottery_tickets:
      Number.isFinite(Number(input.loyaltySnapshot?.extraLotteryTickets)) &&
      Number(input.loyaltySnapshot?.extraLotteryTickets) > 0
        ? Math.floor(Number(input.loyaltySnapshot?.extraLotteryTickets))
        : 0,
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

export async function updateOrderAdminFieldsInSupabase(
  orderId: string,
  input: {
    status?: OrderStatus;
    trackingNumber?: string | null;
  },
): Promise<CmsOrder | null> {
  const supabase = createSupabaseServiceClient();
  const patch: Record<string, string | null> = {};

  if (input.status) {
    patch.status = input.status;
  }

  if (Object.prototype.hasOwnProperty.call(input, "trackingNumber")) {
    const trackingNumber = input.trackingNumber?.trim();
    patch.tracking_number = trackingNumber || null;
  }

  if (Object.keys(patch).length === 0) {
    return findOrderById(orderId);
  }

  const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
  failIfError(error, "update order admin fields");
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
    await awardKqHeritageForPaidOrder(orderId);
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

export async function archiveIncompleteOrderInSupabase(input: {
  orderId: string;
  reason?: string;
}): Promise<CmsOrder | null> {
  const safeOrderId = input.orderId.trim();
  if (!safeOrderId) {
    return null;
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.rpc("rpc_archive_incomplete_order", {
    p_order_id: safeOrderId,
    p_reason: input.reason?.trim() || null,
  });

  failIfError(error, "rpc_archive_incomplete_order");
  return findOrderById(safeOrderId);
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
