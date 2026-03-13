import { NextResponse } from "next/server";
import { rejectOversizedBody } from "@/lib/body-size-guard";
import { logRateLimitRejection, getRequestIp, hitRateLimit } from "@/lib/security-rate-limit";
import {
  logLocalAnalyticsEvent,
  sanitizeLocalAnalyticsEvent,
  sanitizeOptionalGeoField,
} from "@/lib/local-analytics";

export const runtime = "nodejs";

function isAnalyticsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_LOCAL_ANALYTICS_ENABLED !== "false";
}

export async function POST(request: Request) {
  if (!isAnalyticsEnabled()) {
    return NextResponse.json({ ok: true, disabled: true });
  }

  try {
    const rejected = rejectOversizedBody(request);
    if (rejected) return rejected;

    const payload = await request.json().catch(() => null);
    const row = sanitizeLocalAnalyticsEvent(payload);
    if (!row) {
      return NextResponse.json({ error: "Payload analytics invalide." }, { status: 400 });
    }

    const headers = request.headers;
    const countryCode = sanitizeOptionalGeoField(headers.get("x-vercel-ip-country"), 8);
    const regionCode = sanitizeOptionalGeoField(headers.get("x-vercel-ip-country-region"), 32);
    const city = sanitizeOptionalGeoField(headers.get("x-vercel-ip-city"), 120);
    const userAgent = sanitizeOptionalGeoField(headers.get("user-agent"), 300);

    const rowWithGeo = {
      ...row,
      country_code: countryCode,
      region_code: regionCode,
      city,
      user_agent: userAgent,
    };

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

    await logLocalAnalyticsEvent(rowWithGeo);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) {
      console.error("[analytics] event log failed:", error.message);
    }
    return NextResponse.json({ error: "Journalisation analytics indisponible." }, { status: 503 });
  }
}
