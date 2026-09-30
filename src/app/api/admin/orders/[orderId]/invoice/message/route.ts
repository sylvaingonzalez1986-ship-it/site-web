import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import { getInvoicePersonalMessage } from "@/lib/invoice-store";
import { isInvoiceEligibleOrder } from "@/lib/invoice-utils";
import { getOrderByIdByBackend } from "@/lib/order-backend";

export const runtime = "nodejs";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET(
  _: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  try {
    const { orderId } = await params;
    const order = await getOrderByIdByBackend(orderId);
    if (!order) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404, headers: privateHeaders });
    }
    if (!isInvoiceEligibleOrder(order)) {
      return NextResponse.json(
        { error: "Facture indisponible tant que la commande n'est pas payée." },
        { status: 409, headers: privateHeaders },
      );
    }

    const personalMessage = await getInvoicePersonalMessage(order.id);
    return NextResponse.json({ personalMessage }, { headers: privateHeaders });
  } catch (error) {
    console.error("Admin invoice message loading failed:", error);
    return NextResponse.json(
      { error: "Impossible de charger le message de cette facture. Réessayez." },
      { status: 500, headers: privateHeaders },
    );
  }
}
