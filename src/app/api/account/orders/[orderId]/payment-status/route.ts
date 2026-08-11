import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { getOrderByIdByBackend } from "@/lib/order-backend";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(
  _request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const { orderId } = await context.params;
  const order = await getOrderByIdByBackend(orderId);
  if (!order || order.customerId !== session.customerId) {
    return NextResponse.json(
      { error: "Commande introuvable." },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }

  const canResume =
    order.paymentState !== "paid" &&
    order.status !== "cancelled" &&
    !order.archivedAt &&
    Boolean(order.vivaOrderCode);

  return NextResponse.json(
    {
      orderId: order.id,
      paymentState: order.paymentState,
      status: order.status,
      totalAmount: order.totalAmount,
      canResume,
    },
    { headers: NO_STORE_HEADERS },
  );
}
