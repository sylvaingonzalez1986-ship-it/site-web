import { NextResponse } from "next/server";
import { getLotteryConfigByBackend, getCollectionAlbumForCustomerByBackend } from "@/lib/lottery-backend";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";

const PUBLIC_API_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";

export async function GET(request: Request) {
  const ip = getRequestIp(request);
  const rateLimitKey = `public_collection_preview:${ip}`;
  const rateLimit = await hitRateLimit({ key: rateLimitKey, windowSeconds: 60, maxHits: 60 });
  if (!rateLimit.allowed) {
    logRateLimitRejection({
      endpoint: "GET /api/public/collection-preview",
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

  try {
    const [album, config] = await Promise.all([
      getCollectionAlbumForCustomerByBackend(""),
      getLotteryConfigByBackend(),
    ]);

    return NextResponse.json(
      { album, config },
      { headers: { "Cache-Control": PUBLIC_API_CACHE_CONTROL } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lecture preview album impossible.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
