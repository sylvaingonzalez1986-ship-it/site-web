import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import { rejectOversizedBody } from "@/lib/body-size-guard";
import { validateInvoicePersonalMessage } from "@/lib/invoice-message";
import { buildInvoiceResponse } from "@/lib/invoice-pdf";
import {
  getInvoicePersonalMessage,
  issueInvoiceForOrder,
  setInvoicePersonalMessage,
} from "@/lib/invoice-store";
import { isInvoiceEligibleOrder } from "@/lib/invoice-utils";
import { getOrderByIdByBackend } from "@/lib/order-backend";
import type { CmsOrder } from "@/types/store";

export const runtime = "nodejs";

type InvoiceRouteContext = { params: Promise<{ orderId: string }> };

async function getEligibleOrder(orderId: string): Promise<CmsOrder | NextResponse> {
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

  return order;
}

async function downloadInvoice(order: CmsOrder, message?: string) {
  const issuedInvoice = await issueInvoiceForOrder(order.id);
  const personalMessage = message === undefined
    ? await getInvoicePersonalMessage(order.id)
    : await setInvoicePersonalMessage(order.id, message);

  return buildInvoiceResponse(order, issuedInvoice, {
    name: order.customerName?.trim() || "Client",
    email: order.customerEmail?.trim() || "",
    phone: order.shippingPhone?.trim() || "",
    address: order.shippingAddress?.trim() || "",
    city: order.shippingCity?.trim() || "",
    postalCode: order.shippingPostalCode?.trim() || "",
    country: order.shippingCountry?.trim() || "",
  }, { personalMessage });
}

function invoiceFailure(error: unknown): NextResponse {
  console.error("Admin invoice download failed:", error);
  return NextResponse.json(
    { error: "Impossible de préparer la facture. Réessayez." },
    { status: 500, headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function GET(_: Request, { params }: InvoiceRouteContext) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  try {
    const { orderId } = await params;
    const order = await getEligibleOrder(orderId);
    return order instanceof NextResponse ? order : await downloadInvoice(order);
  } catch (error) {
    return invoiceFailure(error);
  }
}

export async function POST(request: Request, { params }: InvoiceRouteContext) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const oversized = rejectOversizedBody(request, 16 * 1024);
  if (oversized) {
    return oversized;
  }

  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return NextResponse.json(
      { error: "Le message doit être envoyé au format JSON." },
      { status: 415 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Message invalide." }, { status: 400 });
  }

  const validated = validateInvoicePersonalMessage(
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>).personalMessage
      : undefined,
  );
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    const { orderId } = await params;
    const order = await getEligibleOrder(orderId);
    return order instanceof NextResponse
      ? order
      : await downloadInvoice(order, validated.message);
  } catch (error) {
    return invoiceFailure(error);
  }
}
