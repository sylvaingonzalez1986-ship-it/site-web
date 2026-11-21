import { isSwissBitcoinPayEnabled } from "@/lib/swiss-bitcoin-pay";

export async function GET() {
  return Response.json({ enabled: isSwissBitcoinPayEnabled() }, { headers: { "Cache-Control": "no-store" } });
}
