import { parseSupportIdentity, SupportError, SUPPORT_UUID } from "@/lib/support-campaign";
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
    if (body.transactionId !== undefined && (typeof body.transactionId !== "string" || !SUPPORT_UUID.test(body.transactionId))) throw new SupportError("Référence de paiement invalide.");
    return supportJson(await refreshOwnedSupport(id, token, body.transactionId as string | undefined));
  } catch (error) { return supportFailure(error); }
}
