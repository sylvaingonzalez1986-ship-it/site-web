import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerApiEnabled } from "@/lib/kanab-quest-player-access";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import { getKqMarketSnapshot, sellKqMarketLot } from "@/lib/supabase/kanab-quest-market-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicMarketError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  return message.startsWith("[supabase:")
    ? { message: "Marché momentanément indisponible.", status: 503 }
    : { message, status: 400 };
}

export async function GET() {
  if (!isKqPlayerApiEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    return NextResponse.json(await getKqMarketSnapshot(session.customerId), {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const failure = publicMarketError(error, "Marché indisponible.");
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }
}

export async function POST(request: Request) {
  if (!isKqPlayerApiEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const ip = getRequestIp(request);
  const key = `kq_market_sale:${session.customerId}:${ip}`;
  const rate = await hitRateLimit({ key, windowSeconds: 600, maxHits: 15 });
  if (!rate.allowed) {
    logRateLimitRejection({
      endpoint: "POST /api/arena/placard/market",
      key,
      ip,
      actorEmail: session.customer.email,
      retryAfterSeconds: rate.retryAfterSeconds,
      maxHits: 15,
      windowSeconds: 600,
    });
    return NextResponse.json({ error: "Trop de tentatives.", retryAfterSeconds: rate.retryAfterSeconds }, {
      status: 429,
      headers: { "Retry-After": String(rate.retryAfterSeconds) },
    });
  }
  try {
    const payload = await request.json() as { flowerId?: string; requestKey?: string; route?: string };
    return NextResponse.json(await sellKqMarketLot({
      userId: session.customerId,
      flowerId: String(payload.flowerId ?? ""),
      requestKey: String(payload.requestKey ?? ""),
      route: String(payload.route ?? ""),
    }));
  } catch (error) {
    const failure = publicMarketError(error, "Vente impossible.");
    return NextResponse.json({ error: failure.message }, { status: failure.status });
  }
}
