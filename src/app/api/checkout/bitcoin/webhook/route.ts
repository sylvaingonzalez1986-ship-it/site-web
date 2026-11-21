import { readRequestBody } from "@/lib/body-size-guard";
import {
  matchesSwissBitcoinSecret,
  swissBitcoinInvoiceId,
  swissBitcoinWebhookHeader,
} from "@/lib/swiss-bitcoin-pay";
import { receiveSwissBitcoinNotification } from "@/lib/swiss-bitcoin-pay-service";

const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (!matchesSwissBitcoinSecret(
    request.headers.get(swissBitcoinWebhookHeader),
    process.env.SWISS_BITCOIN_PAY_WEBHOOK_SECRET?.trim(),
  )) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  try {
    const bounded = await readRequestBody(request, 16 * 1024);
    if (!bounded.ok) return bounded.response;
    const body: unknown = await bounded.body.json().catch(() => null);
    const invoiceId = swissBitcoinInvoiceId(body);
    if (!invoiceId) return Response.json({ error: "Invalid invoice ID" }, { status: 400, headers });
    await receiveSwissBitcoinNotification(invoiceId);
    return Response.json({ ok: true }, { headers });
  } catch {
    console.warn("[swiss-bitcoin-pay] webhook reconciliation unavailable");
    return Response.json({ error: "Payment reconciliation unavailable" }, { status: 503, headers });
  }
}
