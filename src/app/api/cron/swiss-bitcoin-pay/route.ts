import { matchesSwissBitcoinSecret } from "@/lib/swiss-bitcoin-pay";
import { reconcileSwissBitcoinPayments } from "@/lib/swiss-bitcoin-pay-service";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || !matchesSwissBitcoinSecret(request.headers.get("authorization"), `Bearer ${secret}`)) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  try {
    const result = await reconcileSwissBitcoinPayments();
    return Response.json(result, { status: result.failed ? 503 : 200, headers });
  } catch {
    console.warn("[swiss-bitcoin-pay] scheduled reconciliation unavailable");
    return Response.json({ error: "Payment reconciliation unavailable" }, { status: 503, headers });
  }
}
