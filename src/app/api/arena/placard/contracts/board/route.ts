import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { KqContractError } from "@/lib/supabase/kanab-quest-contracts-backend";
import { changeKqContractBoard, getKqContractBoard } from "@/lib/supabase/kanab-quest-renewable-contracts-backend";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof KqContractError ? error.message : "Le comptoir des contrats est momentanément indisponible." }, { status: error instanceof KqContractError ? error.status : 503, headers });
}
export async function GET() {
  try {
    if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404, headers });
    const session = await getCurrentCustomerSessionByBackend("identity");
    if (!session) return NextResponse.json({ error: "Connecte-toi pour retrouver tes contrats." }, { status: 401, headers });
    return NextResponse.json(await getKqContractBoard(session.customerId), { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404, headers });
    const session = await getCurrentCustomerSessionByBackend("identity");
    if (!session) return NextResponse.json({ error: "Connecte-toi pour retrouver tes contrats." }, { status: 401, headers });
    const key = `kq_contracts:${session.customerId}`;
    const rate = await hitRateLimit({ key, windowSeconds: 60, maxHits: 20 });
    if (!rate.allowed) {
      logRateLimitRejection({ endpoint: "POST /api/arena/placard/contracts/board", key, ip: getRequestIp(request), actorEmail: session.customer.email, retryAfterSeconds: rate.retryAfterSeconds, maxHits: 20, windowSeconds: 60 });
      return NextResponse.json({ error: "Patiente un instant avant de réessayer." }, { status: 429, headers: { ...headers, "Retry-After": String(rate.retryAfterSeconds) } });
    }
    let body: unknown;
    try { body = await request.json(); } catch { throw new KqContractError("Demande de contrat invalide.", 400); }
    return NextResponse.json(await changeKqContractBoard(session.customerId, body), { headers });
  } catch (error) { return failure(error); }
}
