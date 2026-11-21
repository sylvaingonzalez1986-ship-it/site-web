import { readRequestBody } from "@/lib/body-size-guard";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { getOrderByIdByBackend } from "@/lib/order-backend";
import { hitRateLimit } from "@/lib/security-rate-limit";
import { switchSwissBitcoinOrderToViva } from "@/lib/swiss-bitcoin-card-fallback";
import {
  getSwissBitcoinPaymentStatus,
  prepareSwissBitcoinPayment,
} from "@/lib/swiss-bitcoin-pay-service";

const headers = { "Cache-Control": "private, no-store, max-age=0" };
type Context = { params: Promise<{ orderId: string }> };

function error(message: string, status: number) {
  return Response.json({ error: message }, { status, headers });
}

async function customerOrder(context: Context, mutation = false) {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) return error("Connexion requise.", 401);
  const decision = await hitRateLimit({
    key: `checkout:bitcoin:${mutation ? "write" : "read"}:${session.customerId}`,
    windowSeconds: 60,
    maxHits: mutation ? 6 : 60,
  });
  if (!decision.allowed) {
    return Response.json({ error: "Trop de demandes. Réessayez dans un instant." }, {
      status: 429,
      headers: { ...headers, "Retry-After": String(decision.retryAfterSeconds) },
    });
  }
  const { orderId } = await context.params;
  if (!/^ORD-\d{8}-\d{4}$/.test(orderId)) return error("Commande introuvable.", 404);
  const order = await getOrderByIdByBackend(orderId);
  return order?.customerId === session.customerId ? order : error("Commande introuvable.", 404);
}

export async function GET(_request: Request, context: Context) {
  try {
    const order = await customerOrder(context);
    if (order instanceof Response) return order;
    const status = await getSwissBitcoinPaymentStatus(order);
    return status ? Response.json(status, { headers }) : error("Commande introuvable.", 404);
  } catch {
    console.warn("[swiss-bitcoin-pay] customer status unavailable");
    return error("Suivi du paiement temporairement indisponible.", 503);
  }
}

export async function POST(request: Request, context: Context) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return error("Demande non autorisée.", 403);
  try {
    const order = await customerOrder(context, true);
    if (order instanceof Response) return order;
    const bounded = await readRequestBody(request, 1024);
    if (!bounded.ok) return bounded.response;
    const body = await bounded.body.json().catch(() => null);
    const action = body?.action;
    if (action !== "retry" && action !== "card") return error("Action de paiement inconnue.", 400);
    const current = await getSwissBitcoinPaymentStatus(order, false);
    if (!current) return error("Commande introuvable.", 404);

    if (action === "card") {
      if (!current.canPayByCard) return error("Le paiement par carte est indisponible pour cette commande.", 409);
      const redirectUrl = await switchSwissBitcoinOrderToViva(order);
      return Response.json({ redirectUrl }, { headers });
    }
    if (!current.canRetry) return error("La création d’une facture est indisponible pour cette commande.", 409);
    await prepareSwissBitcoinPayment(order.id, true);
    const status = await getSwissBitcoinPaymentStatus(order);
    return status ? Response.json(status, { headers }) : error("Commande introuvable.", 404);
  } catch {
    console.warn("[swiss-bitcoin-pay] customer payment action unavailable");
    return error("Cette action est temporairement indisponible.", 503);
  }
}
