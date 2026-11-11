import { parseSupportForm, parseSupportIdentity } from "@/lib/support-campaign";
import { readSupportBody, requireSupportOrigin, supportFailure, supportJson, supportRateLimit } from "@/lib/support-http";
import { startSupportPayment } from "@/lib/support-viva";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireSupportOrigin(request);
    const limited = await supportRateLimit(request, "checkout", 12, 600);
    if (limited) return limited;
    const body = await readSupportBody(request);
    return supportJson(await startSupportPayment({ ...parseSupportIdentity(body), ...parseSupportForm(body) }));
  } catch (error) { return supportFailure(error); }
}
