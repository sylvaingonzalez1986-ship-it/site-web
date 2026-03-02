import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { getCustomerByIdByBackend, getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { bindReferralCodeByBackend, getReferralSummaryByBackend } from "@/lib/referral-backend";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";

export async function GET(request: Request) {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const ip = getRequestIp(request);
  const rateLimitKey = `account_referral:${session.customerId}:${ip}`;
  const rateLimit = await hitRateLimit({ key: rateLimitKey, windowSeconds: 60, maxHits: 30 });
  if (!rateLimit.allowed) {
    logRateLimitRejection({
      endpoint: "GET /api/account/referral",
      key: rateLimitKey,
      ip,
      actorEmail: session.customer.email,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      maxHits: 30,
      windowSeconds: 60,
    });

    return NextResponse.json(
      { error: "Trop de requetes." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const summary = await getReferralSummaryByBackend(session.customerId);
  return NextResponse.json({ summary });
}

export async function POST(request: Request) {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const ip = getRequestIp(request);
  const rateLimitKey = `referral_bind:${session.customerId}:${ip}`;
  const rl = await hitRateLimit({ key: rateLimitKey, windowSeconds: 600, maxHits: 10 });
  if (!rl.allowed) {
    logRateLimitRejection({
      endpoint: "POST /api/account/referral",
      key: rateLimitKey,
      ip,
      actorEmail: session.customer.email,
      retryAfterSeconds: rl.retryAfterSeconds,
      maxHits: 10,
      windowSeconds: 600,
    });

    return NextResponse.json({ error: "Trop de requetes." }, { status: 429 });
  }

  try {
    const payload = (await request.json()) as { code?: string };
    const code = typeof payload.code === "string" ? payload.code.trim() : "";
    if (!code) {
      return NextResponse.json({ error: "Code parrain manquant." }, { status: 400 });
    }

    await bindReferralCodeByBackend({
      refereeId: session.customerId,
      referralCode: code,
    });

    logAuditEvent({
      eventType: "customer_bind_referral",
      actorEmail: session.customer.email,
      ip,
      metadata: {
        customerId: session.customerId,
        referralCode: code,
      },
    });

    const [summary, customer] = await Promise.all([
      getReferralSummaryByBackend(session.customerId),
      getCustomerByIdByBackend(session.customerId),
    ]);

    return NextResponse.json({ summary, user: customer });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible d'appliquer ce code parrain." },
      { status: 400 },
    );
  }
}
