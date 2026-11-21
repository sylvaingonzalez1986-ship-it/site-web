import { matchesSwissBitcoinSecret } from "@/lib/swiss-bitcoin-pay";
import { supportFailure, supportJson } from "@/lib/support-http";
import { reconcileSwissBitcoinSupport } from "@/lib/support-swiss-bitcoin-pay";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || !matchesSwissBitcoinSecret(request.headers.get("authorization"), `Bearer ${secret}`)) {
    return supportJson({ error: "Non autorisé." }, 401);
  }

  try {
    const result = await reconcileSwissBitcoinSupport();
    return supportJson(result, result.failed ? 503 : 200);
  } catch (error) { return supportFailure(error); }
}
