import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import { getKqStaffSnapshot, handleKqStaffAction } from "@/lib/supabase/kanab-quest-staff-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Personnel indisponible.";
  const internal = message.startsWith("[supabase:");
  return NextResponse.json({ error: internal ? "Le bureau du personnel est momentanément indisponible." : message }, { status: internal ? 503 : 400, headers });
}
export async function GET() {
  if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404, headers });
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401, headers });
  try { return NextResponse.json(await getKqStaffSnapshot(session.customerId), { headers }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404, headers });
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401, headers });
  const ip = getRequestIp(request), key = `kq_staff:${session.customerId}:${ip}`;
  const rate = await hitRateLimit({ key, windowSeconds: 60, maxHits: 30 });
  if (!rate.allowed) {
    logRateLimitRejection({ endpoint: "POST /api/arena/placard/staff", key, ip, actorEmail: session.customer.email, retryAfterSeconds: rate.retryAfterSeconds, maxHits: 30, windowSeconds: 60 });
    return NextResponse.json({ error: "Trop de tentatives." }, { status: 429, headers: { ...headers, "Retry-After": String(rate.retryAfterSeconds) } });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400, headers }); }
  try { return NextResponse.json(await handleKqStaffAction(session.customerId, body), { headers }); }
  catch (error) { return failure(error); }
}
