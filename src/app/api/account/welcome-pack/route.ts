import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import {
  getWelcomePackStatusByBackend,
  claimWelcomePackByBackend,
} from "@/lib/lottery-backend";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";

export const runtime = "nodejs";

/**
 * GET /api/account/welcome-pack
 * Returns { eligible: boolean } — whether the current user can still claim a welcome pack.
 */
export async function GET() {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ eligible: false }, { status: 401 });
  }

  try {
    const status = await getWelcomePackStatusByBackend(session.customerId);
    return NextResponse.json(status);
  } catch {
    return NextResponse.json({ eligible: false }, { status: 500 });
  }
}

/**
 * POST /api/account/welcome-pack
 * Claims the one-time welcome pack. Returns { granted: boolean }.
 */
export async function POST(request: Request) {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  const ip = getRequestIp(request);
  const rateLimitKey = `welcome_pack_claim:${session.customerId}`;
  const rateLimit = await hitRateLimit({ key: rateLimitKey, windowSeconds: 60, maxHits: 5 });
  if (!rateLimit.allowed) {
    logRateLimitRejection({
      endpoint: "POST /api/account/welcome-pack",
      key: rateLimitKey,
      ip,
      actorEmail: session.customer.email,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      maxHits: 5,
      windowSeconds: 60,
    });

    return NextResponse.json(
      { error: "Trop de tentatives." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  try {
    const result = await claimWelcomePackByBackend(session.customerId);

    logAuditEvent({
      eventType: "welcome_pack_claimed",
      actorEmail: session.customer.email,
      ip,
      metadata: {
        customerId: session.customerId,
        granted: result.granted,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[welcome-pack] claim error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur lors de la réclamation." },
      { status: 500 },
    );
  }
}
