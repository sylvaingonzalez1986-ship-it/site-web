import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import { getKqOnlineSalesHistory, KqOnlineSalesQueryError, parseKqOnlineSalesQuery } from "@/lib/supabase/kanab-quest-online-sales-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(request: Request) {
  if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404, headers });
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401, headers });
  try {
    const query = parseKqOnlineSalesQuery(new URL(request.url).searchParams);
    const ip = getRequestIp(request);
    const key = `kq_online_sales:${session.customerId}:${ip}`;
    const rate = await hitRateLimit({ key, windowSeconds: 60, maxHits: 30 });
    if (!rate.allowed) {
      logRateLimitRejection({ endpoint: "GET /api/arena/placard/commerce/sales", key, ip, actorEmail: session.customer.email,
        retryAfterSeconds: rate.retryAfterSeconds, maxHits: 30, windowSeconds: 60 });
      return NextResponse.json({ error: "Patiente un instant avant de relire le journal." },
        { status: 429, headers: { ...headers, "Retry-After": String(rate.retryAfterSeconds) } });
    }
    return NextResponse.json(await getKqOnlineSalesHistory(session.customerId, query), { headers });
  } catch (error) {
    const invalid = error instanceof KqOnlineSalesQueryError;
    return NextResponse.json({ error: invalid ? error.message : "Le journal des ventes est momentanément indisponible. Réessaie dans un instant." },
      { status: invalid ? 400 : 503, headers });
  }
}
