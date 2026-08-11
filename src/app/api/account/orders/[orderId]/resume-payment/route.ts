import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { getOrderByIdByBackend } from "@/lib/order-backend";
import { buildVivaCheckoutUrl } from "@/lib/viva-payment";

export async function GET(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const { orderId } = await context.params;
  const order = await getOrderByIdByBackend(orderId);
  if (!order || order.customerId !== session.customerId) {
    return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  }
  if (
    order.paymentState === "paid" ||
    order.status === "cancelled" ||
    order.archivedAt ||
    !order.vivaOrderCode
  ) {
    return NextResponse.redirect(new URL("/profil?tab=commandes", request.url), 303);
  }

  const checkoutUrl = buildVivaCheckoutUrl(order.vivaOrderCode);
  if (!checkoutUrl) {
    return NextResponse.json({ error: "Paiement Viva indisponible." }, { status: 503 });
  }
  return NextResponse.redirect(checkoutUrl, 303);
}
