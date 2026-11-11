import { parseSupportIdentity } from "@/lib/support-campaign";
import { readSupportBody, requireSupportOrigin, supportFailure, supportJson, supportRateLimit } from "@/lib/support-http";
import { cancelOwnedSupport } from "@/lib/support-viva";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireSupportOrigin(request);
    const limited = await supportRateLimit(request, "cancel", 6);
    if (limited) return limited;
    const { id, token } = parseSupportIdentity(await readSupportBody(request));
    return supportJson(await cancelOwnedSupport(id, token));
  } catch (error) { return supportFailure(error); }
}
