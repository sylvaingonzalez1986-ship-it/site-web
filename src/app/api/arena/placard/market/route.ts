import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { getKqMarketSnapshot } from "@/lib/supabase/kanab-quest-market-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicMarketError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  return message.startsWith("[supabase:")
    ? { message: "Marché momentanément indisponible.", status: 503 }
    : { message, status: 400 };
}

export async function GET() {
  if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
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
  if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const ip = getRequestIp(request);
  const key = `kq_market_retired:${session.customerId}:${ip}`;
  const rate = await hitRateLimit({ key, windowSeconds: 60, maxHits: 30 });
  if (!rate.allowed) {
    logRateLimitRejection({ endpoint: "POST /api/arena/placard/market", key, ip, actorEmail: session.customer.email, retryAfterSeconds: rate.retryAfterSeconds, maxHits: 30, windowSeconds: 60 });
    return NextResponse.json({ error: "Patiente avant de réessayer." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  }
  return NextResponse.json({ error: "Le marché utilise désormais les circuits de vente. Actualise la page pour retrouver tes lots." }, { status: 409 });
}
