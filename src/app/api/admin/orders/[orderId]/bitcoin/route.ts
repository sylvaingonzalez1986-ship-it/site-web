import { denyIfNotAdminApi } from "@/lib/admin-guard";
import { logAuditEvent } from "@/lib/audit-log";
import { readRequestBody } from "@/lib/body-size-guard";
import { getRequestIp, hitRateLimit } from "@/lib/security-rate-limit";
import { swissBitcoinId } from "@/lib/swiss-bitcoin-pay";
import { recoverSwissBitcoinInvoice } from "@/lib/swiss-bitcoin-pay-service";

const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const denied = await denyIfNotAdminApi();
  if (denied) return denied;
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json({ error: "Demande non autorisée." }, { status: 403, headers });
  }
  const { orderId } = await params;
  if (!/^ORD-\d{8}-\d{4}$/.test(orderId)) {
    return Response.json({ error: "Commande introuvable." }, { status: 404, headers });
  }
  try {
    const rate = await hitRateLimit({
      key: `admin:swiss-bitcoin-recovery:${getRequestIp(request)}`,
      windowSeconds: 60,
      maxHits: 10,
    });
    if (!rate.allowed) {
      return Response.json({ error: "Trop de demandes." }, {
        status: 429,
        headers: { ...headers, "Retry-After": String(rate.retryAfterSeconds) },
      });
    }
    const bounded = await readRequestBody(request, 1024);
    if (!bounded.ok) return bounded.response;
    const body = await bounded.body.json().catch(() => null);
    const invoiceId = swissBitcoinId(body?.invoiceId);
    if (!invoiceId) {
      return Response.json({ error: "Identifiant de facture Swiss Bitcoin Pay invalide." }, { status: 400, headers });
    }
    if (!await recoverSwissBitcoinInvoice(orderId, invoiceId)) {
      return Response.json({ error: "Cette facture ne correspond pas à une tentative à rapprocher." }, { status: 409, headers });
    }
    logAuditEvent({ eventType: "swiss_bitcoin_invoice_recovered", metadata: { orderId, invoiceId } });
    return Response.json({ ok: true }, { headers });
  } catch {
    return Response.json({ error: "Rapprochement temporairement indisponible." }, { status: 503, headers });
  }
}
