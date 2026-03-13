import "server-only";

import type { AppendOrderInput } from "@/lib/orders-types";
import {
  applyOrderLoyaltyBonusInSupabase,
  archiveIncompleteOrderInSupabase,
  appendOrderToSupabase,
  getOrderByIdInSupabase,
  listCustomerOrdersForLoyaltyInSupabase,
  updateOrderAdminFieldsInSupabase,
  updateOrderPaymentByVivaOrderCodeInSupabase,
  updateOrderPaymentStateInSupabase,
  updateOrderStatusInSupabase,
} from "@/lib/supabase/order-backend";
import type { CmsOrder, OrderStatus } from "@/types/store";

export async function appendOrderByBackend(input: AppendOrderInput): Promise<CmsOrder> {
  return appendOrderToSupabase(input);
}

export async function updateOrderStatusByBackend(
  orderId: string,
  status: OrderStatus,
): Promise<CmsOrder | null> {
  return updateOrderStatusInSupabase(orderId, status);
}

export async function getOrderByIdByBackend(orderId: string): Promise<CmsOrder | null> {
  return getOrderByIdInSupabase(orderId);
}

export async function getCustomerOrdersForLoyaltyByBackend(input: {
  customerId: string;
  customerEmail?: string;
}): Promise<CmsOrder[]> {
  return listCustomerOrdersForLoyaltyInSupabase(input);
}

export async function updateOrderAdminFieldsByBackend(
  orderId: string,
  input: {
    status?: OrderStatus;
    trackingNumber?: string | null;
  },
): Promise<CmsOrder | null> {
  return updateOrderAdminFieldsInSupabase(orderId, input);
}

export async function updateOrderPaymentStateByBackend(
  orderId: string,
  paymentState: CmsOrder["paymentState"],
): Promise<CmsOrder | null> {
  return updateOrderPaymentStateInSupabase(orderId, paymentState);
}

export async function updateOrderPaymentByVivaOrderCodeByBackend(input: {
  orderCode: number;
  paymentState: "paid" | "failed";
  transactionId?: string;
}): Promise<CmsOrder | null> {
  return updateOrderPaymentByVivaOrderCodeInSupabase(input);
}

export async function archiveIncompleteOrderByBackend(input: {
  orderId: string;
  reason?: string;
}): Promise<CmsOrder | null> {
  return archiveIncompleteOrderInSupabase(input);
}

export async function applyOrderLoyaltyBonusByBackend(
  orderId: string,
): Promise<{ applied: boolean; reason?: string; bonusPoints: number }> {
  return applyOrderLoyaltyBonusInSupabase(orderId);
}
