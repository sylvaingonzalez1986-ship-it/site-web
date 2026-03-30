import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import { buildInvoiceResponse } from "@/lib/invoice-pdf";
import { issueInvoiceForOrder } from "@/lib/invoice-store";
import { isInvoiceEligibleOrder } from "@/lib/invoice-utils";
import { getOrderByIdByBackend } from "@/lib/order-backend";

export const runtime = "nodejs";

export async function GET(
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

  if (!isInvoiceEligibleOrder(order)) {
    return NextResponse.json(
      { error: "Facture indisponible tant que la commande n'est pas payee." },
      { status: 409 },
    );
  }

  try {
    const issuedInvoice = await issueInvoiceForOrder(order.id);

    return await buildInvoiceResponse(order, issuedInvoice, {
      name: order.customerName?.trim() || "Client",
      email: order.customerEmail?.trim() || "",
      phone: order.shippingPhone?.trim() || "",
      address: order.shippingAddress?.trim() || "",
      city: order.shippingCity?.trim() || "",
      postalCode: order.shippingPostalCode?.trim() || "",
      country: order.shippingCountry?.trim() || "",
    });
  } catch (error) {
    console.error("Admin invoice download failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de generer la facture pour cette commande.",
      },
      { status: 500 },
    );
  }
}
