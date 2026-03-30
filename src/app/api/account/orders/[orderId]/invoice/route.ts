import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { buildInvoiceResponse } from "@/lib/invoice-pdf";
import { issueInvoiceForOrder } from "@/lib/invoice-store";
import { isInvoiceEligibleOrder } from "@/lib/invoice-utils";
import { getOrderByIdByBackend } from "@/lib/order-backend";

export const runtime = "nodejs";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const { orderId } = await params;
  const order = await getOrderByIdByBackend(orderId);

  if (!order) {
    return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  }

  if (order.customerId !== session.customerId) {
    return NextResponse.json({ error: "Accès interdit." }, { status: 403 });
  }

  if (!isInvoiceEligibleOrder(order)) {
    return NextResponse.json(
      { error: "Facture indisponible tant que la commande n'est pas payée." },
      { status: 409 },
    );
  }

  try {
    const [customer, issuedInvoice] = await Promise.all([
      Promise.resolve(session.customer),
      issueInvoiceForOrder(order.id),
    ]);

    return await buildInvoiceResponse(order, issuedInvoice, {
      name:
        order.customerName?.trim() ||
        `${customer?.firstName ?? ""} ${customer?.lastName ?? ""}`.trim() ||
        "Client",
      email: order.customerEmail?.trim() || customer?.email || "",
      phone: order.shippingPhone?.trim() || customer?.phone || "",
      address: order.shippingAddress?.trim() || customer?.address || "",
      city: order.shippingCity?.trim() || customer?.city || "",
      postalCode: order.shippingPostalCode?.trim() || customer?.postalCode || "",
      country: order.shippingCountry?.trim() || customer?.country || "",
    });
  } catch (error) {
    console.error("Customer invoice download failed:", error);

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
