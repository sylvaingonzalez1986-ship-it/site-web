import { issueInvoiceForOrder } from "@/lib/invoice-store";
import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import { logAuditEvent } from "@/lib/audit-log";
import {
  consumeLotteryRewardClaimsForOrderByBackend,
  mintLotteryTicketsForOrderByBackend,
  releaseLotteryRewardClaimsForOrderByBackend,
} from "@/lib/lottery-backend";
import { sendOrderProcessingEmail, sendOrderShippedEmail } from "@/lib/order-email";
import {
  applyOrderLoyaltyBonusByBackend,
  getOrderByIdByBackend,
  updateOrderAdminFieldsByBackend,
  updateOrderPaymentStateByBackend,
} from "@/lib/order-backend";
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
      trackingNumber?: string | null;
    };

    const hasTrackingUpdate = Object.prototype.hasOwnProperty.call(payload, "trackingNumber");

    if (!payload.status && !payload.paymentState && !hasTrackingUpdate) {
      return NextResponse.json({ error: "Aucune modification demandee." }, { status: 400 });
    }

    const previousOrder = await getOrderByIdByBackend(orderId);
    if (!previousOrder) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    }

    let updated: CmsOrder | null = null;

    if (payload.status || hasTrackingUpdate) {
      updated = await updateOrderAdminFieldsByBackend(orderId, {
        status: payload.status,
        trackingNumber: hasTrackingUpdate ? payload.trackingNumber ?? null : undefined,
      });
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
            bonusTicketCount: updated.extraLotteryTickets ?? 0,
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

    if (
      payload.status &&
      previousOrder.status !== updated.status &&
      updated.customerEmail
    ) {
      if (updated.status === "processing") {
        try {
          await sendOrderProcessingEmail(updated);
        } catch (error) {
          console.error("sendOrderProcessingEmail failed:", error);
        }
      }

      if (updated.status === "shipped") {
        try {
          await sendOrderShippedEmail(updated);
        } catch (error) {
          console.error("sendOrderShippedEmail failed:", error);
        }
      }
    }

    logAuditEvent({ eventType: "update_order", metadata: { orderId, status: payload.status, paymentState: payload.paymentState } });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Payload invalide." }, { status: 400 });
  }
}
