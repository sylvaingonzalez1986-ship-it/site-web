import { NextResponse } from "next/server";
import { readPublicStoreByBackend } from "@/lib/data-backend";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";

const PUBLIC_API_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";

export async function GET(request: Request) {
  const ip = getRequestIp(request);
  const rateLimitKey = `public_store:${ip}`;
  const rateLimit = await hitRateLimit({ key: rateLimitKey, windowSeconds: 60, maxHits: 60 });
  if (!rateLimit.allowed) {
    logRateLimitRejection({
      endpoint: "GET /api/public/store",
      key: rateLimitKey,
      ip,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      maxHits: 60,
      windowSeconds: 60,
    });

    return NextResponse.json(
      { error: "Trop de requetes." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const store = await readPublicStoreByBackend();
  return NextResponse.json(store, {
    headers: {
      "Cache-Control": PUBLIC_API_CACHE_CONTROL,
    },
  });
}
