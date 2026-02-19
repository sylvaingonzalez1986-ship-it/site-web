import { NextResponse } from "next/server";
import type { CmsOrder, OrderStatus } from "@/types/store";
import { updateOrderPaymentStateByBackend, updateOrderStatusByBackend } from "@/lib/order-backend";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
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
    }

    if (!updated) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Payload invalide." }, { status: 400 });
  }
}
