import { isArenaPrelaunch, ARENA_OPENING_MESSAGE, ARENA_OPENING_AT } from "@/lib/arena-opening";
﻿import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { getPioneerPack, claimPioneerPack, PioneerPackError } from "@/lib/supabase/pioneer-pack-backend";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import { logAuditEvent } from "@/lib/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof PioneerPackError ? error.message : "Le Pack des Pionniers est momentanément indisponible." }, { status: error instanceof PioneerPackError ? error.status : 503, headers });
}
export async function GET() {
  try {
    const session = await getCurrentCustomerSessionByBackend("identity");
    if (!session) return NextResponse.json({ error: "Connecte-toi pour retrouver ton pack." }, { status: 401, headers });
    return NextResponse.json(await getPioneerPack(session.customerId), { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  if (isArenaPrelaunch()) return NextResponse.json({ error: ARENA_OPENING_MESSAGE, opensAt: ARENA_OPENING_AT }, { status: 423, headers });
  try {
    const session = await getCurrentCustomerSessionByBackend("identity");
    if (!session) return NextResponse.json({ error: "Connecte-toi pour recevoir ton pack." }, { status: 401, headers });
    const key = `pioneer_pack:${session.customerId}`;
    const rate = await hitRateLimit({ key, windowSeconds: 60, maxHits: 5 });
    if (!rate.allowed) {
      logRateLimitRejection({ endpoint: "POST /api/account/pioneer-pack", key, ip: getRequestIp(request), actorEmail: session.customer.email, retryAfterSeconds: rate.retryAfterSeconds, maxHits: 5, windowSeconds: 60 });
      return NextResponse.json({ error: "Patiente un instant avant de réessayer." }, { status: 429, headers: { ...headers, "Retry-After": String(rate.retryAfterSeconds) } });
    }
    // Identity, eligibility and the entire reward are resolved server-side; no body is needed.
    const result = await claimPioneerPack(session.customerId);
    logAuditEvent({ eventType: "pioneer_pack_claimed", actorEmail: session.customer.email, ip: getRequestIp(request), metadata: { customerId: session.customerId, replayed: result.replayed } });
    return NextResponse.json(result, { headers });
  } catch (error) { return failure(error); }
}
