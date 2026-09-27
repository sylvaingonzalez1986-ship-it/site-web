import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { getRequestIp, hitRateLimit } from "@/lib/security-rate-limit";
import { getKqOrderCashRewards, syncKqOrderCashRewards } from "@/lib/supabase/kanab-quest-order-cash-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET() {
  try {
    const session = await getCurrentCustomerSessionByBackend();
    const rewards = await getKqOrderCashRewards(session?.customerId ?? null);
    return NextResponse.json({ rewards }, { headers: HEADERS });
  } catch {
    return NextResponse.json({ error: "Bonus de commande indisponible." }, { status: 503, headers: HEADERS });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentCustomerSessionByBackend();
    if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401, headers: HEADERS });
    const rateLimit = await hitRateLimit({
      key: `order_cash_rewards:${session.customerId}:${getRequestIp(request)}`,
      windowSeconds: 60, maxHits: 20,
    });
    if (!rateLimit.allowed) return NextResponse.json({ error: "Trop de requêtes." }, {
      status: 429, headers: { ...HEADERS, "Retry-After": String(rateLimit.retryAfterSeconds) },
    });
    // Neither the beneficiary nor the order amount is ever accepted from the browser.
    const rewards = await syncKqOrderCashRewards(session.customerId);
    return NextResponse.json({ rewards }, { headers: HEADERS });
  } catch {
    return NextResponse.json({ error: "Bonus de commande indisponible." }, { status: 503, headers: HEADERS });
  }
}
