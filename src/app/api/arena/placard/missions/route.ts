import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { getKqMissions, claimKqMission, KqMissionError } from "@/lib/supabase/kanab-quest-missions-backend";
import { hitRateLimit } from "@/lib/security-rate-limit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof KqMissionError ? error.message : "Le centre de missions est momentanément indisponible." }, { status: error instanceof KqMissionError ? error.status : 503, headers });
}
export async function GET() {
  try {
    if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404, headers });
    const session = await getCurrentCustomerSessionByBackend("identity");
    if (!session) return NextResponse.json({ error: "Connecte-toi pour retrouver tes missions." }, { status: 401, headers });
    return NextResponse.json(await getKqMissions(session.customerId), { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404, headers });
    const session = await getCurrentCustomerSessionByBackend("identity");
    if (!session) return NextResponse.json({ error: "Connecte-toi pour récupérer ton pack." }, { status: 401, headers });
    const rate = await hitRateLimit({ key: `kq_missions:${session.customerId}`, windowSeconds: 60, maxHits: 20 });
    if (!rate.allowed) return NextResponse.json({ error: "Patiente un instant avant de réessayer." }, { status: 429, headers: { ...headers, "Retry-After": String(rate.retryAfterSeconds) } });
    let body: unknown;
    try { body = await request.json(); } catch { throw new KqMissionError("Demande invalide.", 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new KqMissionError("Demande invalide.", 400);
    return NextResponse.json(await claimKqMission(session.customerId, (body as Record<string, unknown>).code), { headers });
  } catch (error) { return failure(error); }
}
