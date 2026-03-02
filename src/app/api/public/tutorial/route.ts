import { NextResponse } from "next/server";
import { isCmsPagesEnabledServer } from "@/lib/cms-pages-feature";
import { readTutorialCmsPagesByBackend } from "@/lib/cms-pages-backend";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";

const PUBLIC_API_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";

export async function GET(request: Request) {
  const ip = getRequestIp(request);
  const rateLimitKey = `public_tutorial:${ip}`;
  const rateLimit = await hitRateLimit({ key: rateLimitKey, windowSeconds: 60, maxHits: 60 });
  if (!rateLimit.allowed) {
    logRateLimitRejection({
      endpoint: "GET /api/public/tutorial",
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

  if (!isCmsPagesEnabledServer()) {
    return NextResponse.json({ pages: [] }, { headers: { "Cache-Control": PUBLIC_API_CACHE_CONTROL } });
  }

  const pages = await readTutorialCmsPagesByBackend();
  return NextResponse.json({ pages }, { headers: { "Cache-Control": PUBLIC_API_CACHE_CONTROL } });
}
