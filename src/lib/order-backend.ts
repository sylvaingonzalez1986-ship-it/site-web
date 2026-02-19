import "server-only";

import type { AppendOrderInput } from "@/lib/orders-types";
import {
  appendOrderToSupabase,
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
