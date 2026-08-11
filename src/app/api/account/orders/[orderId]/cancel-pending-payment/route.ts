import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { failCheckoutAttemptForOrder } from "@/lib/checkout-attempt";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { archiveIncompleteOrderByBackend, getOrderByIdByBackend } from "@/lib/order-backend";
import { getRequestIp, hitRateLimit } from "@/lib/security-rate-limit";
import { cancelVivaPaymentOrder, getVivaConfig } from "@/lib/viva-payment";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

export async function POST(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const ip = getRequestIp(request);
  const rateLimit = await hitRateLimit({
    key: `cancel_pending_payment:${session.customerId}:${ip}`,
    windowSeconds: 60,
    maxHits: 5,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives. Reessaie dans un instant." },
      {
        status: 429,
        headers: { ...NO_STORE_HEADERS, "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const { orderId } = await context.params;
  const order = await getOrderByIdByBackend(orderId);
  if (!order || order.customerId !== session.customerId) {
    return NextResponse.json(
      { error: "Commande introuvable." },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }
  if (order.paymentState === "paid" || order.status === "cancelled" || order.archivedAt) {
    return NextResponse.json(
      { error: "Cette commande ne peut plus etre modifiee." },
      { status: 409, headers: NO_STORE_HEADERS },
    );
  }
  if (!order.vivaOrderCode) {
    return NextResponse.json(
      { error: "Session Viva introuvable." },
      { status: 409, headers: NO_STORE_HEADERS },
    );
  }

  const config = getVivaConfig();
  if (
    !config.isConfigured ||
    !process.env.VIVA_MERCHANT_ID?.trim() ||
    !process.env.VIVA_API_KEY?.trim()
  ) {
    return NextResponse.json(
      {
        error:
          "La modification securisee du panier n'est pas encore configuree. Reprends le paiement existant ou contacte-nous.",
        code: "viva_cancellation_not_configured",
      },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  try {
    // Never archive locally before Viva confirms that the old URL is no longer payable.
    await cancelVivaPaymentOrder({ config, orderCode: order.vivaOrderCode });
    const archived = await archiveIncompleteOrderByBackend({
      orderId: order.id,
      reason: "customer_requested_cart_change",
    });
    if (!archived?.archivedAt) {
      throw new Error("La tentative de commande n'a pas ete archivee.");
    }
    try {
      await failCheckoutAttemptForOrder(order.id, "customer_requested_cart_change");
    } catch (error) {
      console.error("Unable to close checkout attempt after Viva cancellation:", error);
    }

    logAuditEvent({
      eventType: "customer_cancel_pending_payment",
      actorEmail: session.customer.email,
      ip,
      metadata: { orderId: order.id },
    });
    return NextResponse.json(
      { ok: true, orderId: order.id, cartCanBeModified: true },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("Unable to cancel pending Viva payment:", error);
    return NextResponse.json(
      { error: "La session de paiement n'a pas pu etre annulee. Aucun changement n'a ete applique." },
      { status: 502, headers: NO_STORE_HEADERS },
    );
  }
}
