import { issueInvoiceForOrder } from "@/lib/invoice-store";
import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import { logAuditEvent } from "@/lib/audit-log";
import {
  consumeLotteryRewardClaimsForOrderByBackend,
  mintLotteryTicketsForOrderByBackend,
  releaseLotteryRewardClaimsForOrderByBackend,
} from "@/lib/lottery-backend";
import { applyOrderLoyaltyBonusByBackend, updateOrderPaymentStateByBackend, updateOrderStatusByBackend } from "@/lib/order-backend";
import { applyReferralRewardForPaidOrderByBackend } from "@/lib/referral-backend";
import type { CmsOrder, OrderStatus } from "@/types/store";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const { orderId } = await params;

  try {
    const payload = (await request.json()) as {
      status?: OrderStatus;
      paymentState?: CmsOrder["paymentState"];
    };

    if (!payload.status && !payload.paymentState) {
      return NextResponse.json({ error: "Aucune modification demandee." }, { status: 400 });
    }

    let updated: CmsOrder | null = null;

    if (payload.status) {
      updated = await updateOrderStatusByBackend(orderId, payload.status);
      if (!updated) {
        return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
      }
    }

    if (payload.paymentState) {
      updated = await updateOrderPaymentStateByBackend(orderId, payload.paymentState);
      if (!updated) {
        return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
      }

      if (payload.paymentState === "failed") {
        await releaseLotteryRewardClaimsForOrderByBackend(updated.id);
      }

      if (payload.paymentState === "paid") {
        await consumeLotteryRewardClaimsForOrderByBackend(updated.id);
        await issueInvoiceForOrder(updated.id);
        await applyOrderLoyaltyBonusByBackend(updated.id);
        if (updated.customerId) {
          await mintLotteryTicketsForOrderByBackend({
            userId: updated.customerId,
            orderId: updated.id,
            orderAmount: updated.totalAmount,
          });
          try {
            await applyReferralRewardForPaidOrderByBackend({ orderId: updated.id });
          } catch (error) {
            console.error("Referral reward application failed on admin order update:", error);
          }
        }
      }
    }

    if (!updated) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    }

    logAuditEvent({ eventType: "update_order", metadata: { orderId, status: payload.status, paymentState: payload.paymentState } });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Payload invalide." }, { status: 400 });
  }
}
