import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import { getKqTreasurySnapshot, parseKqTreasuryQuery } from "@/lib/supabase/kanab-quest-treasury-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(request: Request) {
  if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404, headers });
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401, headers });
  try {
    const query = parseKqTreasuryQuery(new URL(request.url).searchParams);
    const ip = getRequestIp(request);
    const key = `kq_treasury:${session.customerId}:${ip}`;
    const rate = await hitRateLimit({ key, windowSeconds: 60, maxHits: 30 });
    if (!rate.allowed) {
      logRateLimitRejection({ endpoint: "GET /api/arena/placard/treasury", key, ip, actorEmail: session.customer.email,
        retryAfterSeconds: rate.retryAfterSeconds, maxHits: 30, windowSeconds: 60 });
      return NextResponse.json({ error: "Patiente un instant avant d’actualiser les comptes." },
        { status: 429, headers: { ...headers, "Retry-After": String(rate.retryAfterSeconds) } });
    }
    return NextResponse.json(await getKqTreasurySnapshot(session.customerId, query), { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "[supabase:treasury] unavailable";
    const unavailable = message !== "Période ou page comptable invalide." && message !== "Compte trésorerie invalide.";
    return NextResponse.json({ error: unavailable ? "La trésorerie est momentanément indisponible. Réessaie dans un instant." : message },
      { status: unavailable ? 503 : 400, headers });
  }
}
