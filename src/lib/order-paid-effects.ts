import "server-only";

import { issueInvoiceForOrder } from "@/lib/invoice-store";
import {
  consumeLotteryRewardClaimsForOrderByBackend,
  mintLotteryTicketsForOrderByBackend,
} from "@/lib/lottery-backend";
import { applyOrderLoyaltyBonusByBackend } from "@/lib/order-backend";
import { applyReferralRewardForPaidOrderByBackend } from "@/lib/referral-backend";
import type { CmsOrder } from "@/types/store";

export async function processPaidOrder(order: CmsOrder, reviewRequired = false): Promise<void> {
  await issueInvoiceForOrder(order.id);
  if (reviewRequired || order.paymentReviewRequired || order.status === "cancelled") return;

  await consumeLotteryRewardClaimsForOrderByBackend(order.id);
  await applyOrderLoyaltyBonusByBackend(order.id);
  if (order.customerId) {
    await mintLotteryTicketsForOrderByBackend({
      userId: order.customerId,
      orderId: order.id,
      orderAmount: order.totalAmount,
      bonusTicketCount: order.extraLotteryTickets ?? 0,
    });
    await applyReferralRewardForPaidOrderByBackend({ orderId: order.id });
  }
}
