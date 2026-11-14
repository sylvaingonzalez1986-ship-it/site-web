import { readRequestBody } from "@/lib/body-size-guard";
import { NextResponse } from "next/server";
import { isArenaPrelaunch } from "@/lib/arena-opening";
import { isContestFeatureEnabledServer } from "@/lib/contest-feature";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerApiEnabled } from "@/lib/kanab-quest-player-access";
import { isKqPlayerIdentityEnabled } from "@/lib/kanab-quest-player-request-access";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import { getKqStaffSnapshot, handleKqStaffAction } from "@/lib/supabase/kanab-quest-staff-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
const OWNER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isStaffFeatureEnabled() {
  return (!isArenaPrelaunch() && isKqPlayerApiEnabled()) || isContestFeatureEnabledServer();
}
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Personnel indisponible.";
  const internal = message.startsWith("[supabase:");
  return NextResponse.json({ error: internal ? "Le bureau du personnel est momentanément indisponible." : message }, { status: internal ? 503 : 400, headers });
}
export async function GET() {
  if (!isStaffFeatureEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404, headers });
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401, headers });
  if (!await isKqPlayerIdentityEnabled(session)) return NextResponse.json({ error: "Introuvable." }, { status: 404, headers });
  try { return NextResponse.json(await getKqStaffSnapshot(session.customerId), { headers }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  if (!isStaffFeatureEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404, headers });
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401, headers });
  if (!await isKqPlayerIdentityEnabled(session)) return NextResponse.json({ error: "Introuvable." }, { status: 404, headers });
  const ip = getRequestIp(request), key = `kq_staff:${session.customerId}:${ip}`;
  const rate = await hitRateLimit({ key, windowSeconds: 60, maxHits: 30 });
  if (!rate.allowed) {
    logRateLimitRejection({ endpoint: "POST /api/arena/placard/staff", key, ip, actorEmail: session.customer.email, retryAfterSeconds: rate.retryAfterSeconds, maxHits: 30, windowSeconds: 60 });
    return NextResponse.json({ error: "Trop de tentatives." }, { status: 429, headers: { ...headers, "Retry-After": String(rate.retryAfterSeconds) } });
  }
  let body: unknown;
  try {
    const boundedBody = await readRequestBody(request);
    if (!boundedBody.ok) return boundedBody.response;
    body = await boundedBody.body.json(); } catch { return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400, headers }); }
  if (body && typeof body === "object" && "expectedOwnerId" in body) {
    const expectedOwnerId = body.expectedOwnerId;
    if (typeof expectedOwnerId !== "string" || !OWNER_ID.test(expectedOwnerId)) {
      return NextResponse.json({ error: "Propriétaire de confirmation invalide." }, { status: 400, headers });
    }
    // A persisted key belongs to one account; another tab may have changed the session.
    if (expectedOwnerId.toLowerCase() !== session.customerId.toLowerCase()) {
      return NextResponse.json({ code: "staff_owner_changed", error: "Le compte connecté a changé. Reconnecte-toi au compte de cette confirmation avant de réessayer." }, { status: 409, headers });
    }
  }
  try { return NextResponse.json(await handleKqStaffAction(session.customerId, body), { headers }); }
  catch (error) { return failure(error); }
}
