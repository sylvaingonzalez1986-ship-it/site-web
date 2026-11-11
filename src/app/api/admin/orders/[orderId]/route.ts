import { readRequestBody } from "@/lib/body-size-guard";
import { issueInvoiceForOrder } from "@/lib/invoice-store";
import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import { logAuditEvent } from "@/lib/audit-log";
import { mintLotteryTicketsForOrderByBackend } from "@/lib/lottery-backend";
import { sendOrderProcessingEmail, sendOrderShippedEmail } from "@/lib/order-email";
import { canArchiveIncompleteOrder } from "@/lib/order-lifecycle";
import {
  applyOrderLoyaltyBonusByBackend,
  archiveIncompleteOrderByBackend,
  getOrderByIdByBackend,
  updateOrderAdminFieldsByBackend,
} from "@/lib/order-backend";
import { applyReferralRewardForPaidOrderByBackend } from "@/lib/referral-backend";
import { cancelVivaPaymentOrder, getVivaConfig } from "@/lib/viva-payment";
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
    const boundedBody = await readRequestBody(request);
    if (!boundedBody.ok) return boundedBody.response;
    const payload = (await boundedBody.body.json()) as {
      status?: OrderStatus;
      paymentState?: CmsOrder["paymentState"];
      trackingNumber?: string | null;
    };

    if (!payload || typeof payload !== "object" || Array.isArray(payload)
      || (payload.status !== undefined && !["new", "pending_payment", "paid", "processing", "shipped", "cancelled"].includes(payload.status))
      || (payload.paymentState !== undefined && !["pending", "paid", "failed"].includes(payload.paymentState))
      || (payload.trackingNumber !== undefined && payload.trackingNumber !== null
        && (typeof payload.trackingNumber !== "string" || payload.trackingNumber.length > 200))) {
      return NextResponse.json({ error: "Payload invalide." }, { status: 400 });
    }

    const hasTrackingUpdate = Object.prototype.hasOwnProperty.call(payload, "trackingNumber");

    if (!payload.status && !payload.paymentState && !hasTrackingUpdate) {
      return NextResponse.json({ error: "Aucune modification demandee." }, { status: 400 });
    }

    const previousOrder = await getOrderByIdByBackend(orderId);
    if (!previousOrder) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    }

    if (previousOrder.archivedAt) {
      return NextResponse.json(
        { error: "Cette commande a deja ete retiree de la liste." },
        { status: 409 },
      );
    }

    const updated = await updateOrderAdminFieldsByBackend(orderId, {
      status: payload.status,
      paymentState: payload.paymentState,
      trackingNumber: hasTrackingUpdate ? payload.trackingNumber ?? null : undefined,
    });
    if (!updated) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    }

    if (payload.paymentState === "paid" && updated.paymentState === "paid") {
      await issueInvoiceForOrder(updated.id);
      if (!updated.paymentReviewRequired && updated.status !== "cancelled") {
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
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Payload invalide." }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "";
    if (message.includes("order_transition_") || message.includes("inventory_")) {
      return NextResponse.json({
        error: "Transition refusee : verifie le paiement, le stock et les alertes de la commande. Une annulation utilise le retrait de commande ; un paiement confirme ne peut pas etre retrograde.",
      }, { status: 409 });
    }
    console.error("Admin order update failed:", error);
    return NextResponse.json({ error: "Modification indisponible. Verifie le statut puis reessaie." }, { status: 503 });
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const { orderId } = await params;
  const order = await getOrderByIdByBackend(orderId);

  if (!order) {
    return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  }

  if (!canArchiveIncompleteOrder(order)) {
    return NextResponse.json(
      { error: "Seules les commandes non finalisees peuvent etre retirees." },
      { status: 409 },
    );
  }

  try {
    if (order.vivaOrderCode) {
      // Do not release local reservations while an external payment URL is active.
      // The archive RPC rechecks the payment under its row lock after this call.
      await cancelVivaPaymentOrder({ config: getVivaConfig(), orderCode: order.vivaOrderCode });
    }
    const archivedOrder = await archiveIncompleteOrderByBackend({
      orderId,
      reason: "admin_removed_incomplete",
    });

    if (!archivedOrder) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    }

    logAuditEvent({
      eventType: "archive_order",
      metadata: { orderId, archivedReason: archivedOrder.archivedReason ?? "admin_removed_incomplete" },
    });

    return NextResponse.json(archivedOrder);
  } catch (error) {
    console.error("Admin order cancellation failed:", error);
    return NextResponse.json({ error: "Annulation non confirmee. Verifie le paiement puis reessaie ; la commande n'a pas ete retiree." }, { status: 409 });
  }
}
