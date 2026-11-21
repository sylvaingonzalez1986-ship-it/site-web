import { readRequestBody } from "@/lib/body-size-guard";
import { matchesSwissBitcoinSecret, swissBitcoinInvoiceId, swissBitcoinWebhookHeader } from "@/lib/swiss-bitcoin-pay";
import { supportFailure, supportJson } from "@/lib/support-http";
import { receiveSwissBitcoinSupportNotification } from "@/lib/support-swiss-bitcoin-pay";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!matchesSwissBitcoinSecret(request.headers.get(swissBitcoinWebhookHeader), process.env.SWISS_BITCOIN_PAY_WEBHOOK_SECRET?.trim())) {
    return supportJson({ error: "Notification non autorisée." }, 401);
  }

  try {
    const bounded = await readRequestBody(request, 16_384);
    if (!bounded.ok) return bounded.response;
    const body: unknown = await bounded.body.json().catch(() => null);
    const invoiceId = swissBitcoinInvoiceId(body);
    if (!invoiceId) return supportJson({ error: "Référence de facture invalide." }, 400);
    await receiveSwissBitcoinSupportNotification(invoiceId);
    return supportJson({ ok: true });
  } catch (error) { return supportFailure(error); }
}
