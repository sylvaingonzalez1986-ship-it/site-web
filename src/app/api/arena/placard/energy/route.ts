import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import { getKqEnergySnapshot, payKqEnergy } from "@/lib/supabase/kanab-quest-energy-backend";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Électricité indisponible.";
  return NextResponse.json({ error: message.startsWith("[supabase:") ? "Service électrique momentanément indisponible." : message }, { status: message.startsWith("[supabase:") ? 503 : 400, headers });
}
export async function GET() {
  if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try { return NextResponse.json(await getKqEnergySnapshot(session.customerId), { headers }); } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const ip = getRequestIp(request);
  const key = `kq_energy:${session.customerId}:${ip}`;
  const rate = await hitRateLimit({ key, windowSeconds: 60, maxHits: 12 });
  if (!rate.allowed) {
    logRateLimitRejection({ endpoint: "POST /api/arena/placard/energy", key, ip, actorEmail: session.customer.email, retryAfterSeconds: rate.retryAfterSeconds, maxHits: 12, windowSeconds: 60 });
    return NextResponse.json({ error: "Trop de tentatives." }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  }
  try {
    const payload = await request.json() as { requestKey?: string; expectedCents?: number };
    return NextResponse.json(await payKqEnergy({ userId: session.customerId, requestKey: String(payload.requestKey ?? ""), expectedCents: payload.expectedCents ?? 0 }), { headers });
  } catch (error) { return failure(error); }
}
