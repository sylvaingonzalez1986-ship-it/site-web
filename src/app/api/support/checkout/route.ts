import { parseSupportForm, parseSupportIdentity, parseSupportProvider } from "@/lib/support-campaign";
import { readSupportBody, requireSupportOrigin, supportFailure, supportJson, supportRateLimit } from "@/lib/support-http";
import { startSwissBitcoinSupport } from "@/lib/support-swiss-bitcoin-pay";
import { startSupportPayment } from "@/lib/support-viva";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireSupportOrigin(request);
    const limited = await supportRateLimit(request, "checkout", 12, 600);
    if (limited) return limited;
    const body = await readSupportBody(request);
    const provider = parseSupportProvider(body.provider);
    const attempt = { ...parseSupportIdentity(body), ...parseSupportForm(body) };
    return supportJson(provider === "swiss-bitcoin-pay" ? await startSwissBitcoinSupport(attempt) : await startSupportPayment(attempt));
  } catch (error) { return supportFailure(error); }
}
