import { parseSupportIdentity, SupportError, SUPPORT_UUID, SUPPORT_VIVA_ORDER_CODE } from "@/lib/support-campaign";
import { readSupportBody, requireSupportOrigin, supportFailure, supportJson, supportRateLimit } from "@/lib/support-http";
import { refreshOwnedSupport } from "@/lib/support-viva";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireSupportOrigin(request);
    const limited = await supportRateLimit(request, "status", 45);
    if (limited) return limited;
    const body = await readSupportBody(request);
    const { id, token } = parseSupportIdentity(body);
    const { transactionId, orderCode } = body;
    if (transactionId !== undefined && (typeof transactionId !== "string" || !SUPPORT_UUID.test(transactionId))) throw new SupportError("Référence de paiement invalide.");
    if (orderCode !== undefined && (typeof orderCode !== "string" || !SUPPORT_VIVA_ORDER_CODE.test(orderCode))) throw new SupportError("Référence de commande Viva invalide.");
    return supportJson(await refreshOwnedSupport(id, token, transactionId, orderCode));
  } catch (error) { return supportFailure(error); }
}
