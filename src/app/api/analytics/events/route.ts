import { NextResponse } from "next/server";
import { logRateLimitRejection, getRequestIp, hitRateLimit } from "@/lib/security-rate-limit";
import { logLocalAnalyticsEvent, sanitizeLocalAnalyticsEvent } from "@/lib/local-analytics";

export const runtime = "nodejs";

function isAnalyticsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_LOCAL_ANALYTICS_ENABLED !== "false";
}

export async function POST(request: Request) {
  if (!isAnalyticsEnabled()) {
    return NextResponse.json({ ok: true, disabled: true });
  }

  try {
    const payload = await request.json().catch(() => null);
    const row = sanitizeLocalAnalyticsEvent(payload);
    if (!row) {
      return NextResponse.json({ error: "Payload analytics invalide." }, { status: 400 });
    }

    const ip = getRequestIp(request);
    const rateLimitKey = `analytics_event:${ip}:${row.event_name}`;
    const rateLimit = await hitRateLimit({ key: rateLimitKey, windowSeconds: 60, maxHits: 90 });
    if (!rateLimit.allowed) {
      logRateLimitRejection({
        endpoint: "POST /api/analytics/events",
        key: rateLimitKey,
        ip,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        maxHits: 90,
        windowSeconds: 60,
      });
      return NextResponse.json(
        { error: "Trop d'evenements analytics. Reessaie plus tard." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }

    await logLocalAnalyticsEvent(row);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) {
      console.error("[analytics] event log failed:", error.message);
    }
    return NextResponse.json({ error: "Journalisation analytics indisponible." }, { status: 503 });
  }
}
