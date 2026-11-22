import { NextResponse } from "next/server";
import { readRequestBody } from "@/lib/body-size-guard";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqSameOriginRequest } from "@/lib/kanab-quest-request-origin";
import { normalizeShippingPhone } from "@/lib/shipping-phone";
import { createArenaPrizeDelivery } from "@/lib/supabase/arena-customer-rewards-backend";

const headers = { "Cache-Control": "private, no-store" };
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const field = (body: Record<string, unknown>, key: string) => typeof body[key] === "string" ? body[key].replace(/[\r\n]+/g, " ").trim() : "";

export async function POST(request: Request) {
  if (!request.headers.get("origin") || !isKqSameOriginRequest(request)) {
    return NextResponse.json({ error: "Origine de la demande invalide." }, { status: 403, headers });
  }
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Reconnecte-toi pour retrouver ton lot." }, { status: 401, headers });
  const bounded = await readRequestBody(request, 4096);
  if (!bounded.ok) return bounded.response;
  const body = await bounded.body.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !uuid.test(field(body, "grantId"))) return NextResponse.json({ error: "Lot introuvable." }, { status: 404, headers });

  const phoneInput = field(body, "phone");
  const phone = normalizeShippingPhone(phoneInput, "FR");
  if (phoneInput && !phone) return NextResponse.json({ error: "Vérifie ton numéro de téléphone." }, { status: 422, headers });
  try {
    const { data, error } = await createArenaPrizeDelivery(field(body, "grantId"), session.customerId, {
      name: field(body, "name"), address: field(body, "address"), city: field(body, "city"),
      postalCode: field(body, "postalCode"), email: session.customer.email, phone,
    });
    if (error?.message.includes("arena_customer_prize_not_found")) return NextResponse.json({ error: "Lot introuvable." }, { status: 404, headers });
    if (error?.message.includes("arena_customer_prize_shipping_invalid")) return NextResponse.json({ error: "Vérifie les coordonnées de livraison en France métropolitaine." }, { status: 422, headers });
    if (!error && data?.orderId && data.totalCents === 0) return NextResponse.json(data, { headers });
  } catch { /* The same grant can be retried safely after a lost response. */ }
  return NextResponse.json({ error: "Confirmation indisponible. Réessaie ou recharge la page pour retrouver ta commande." }, { status: 503, headers });
}
