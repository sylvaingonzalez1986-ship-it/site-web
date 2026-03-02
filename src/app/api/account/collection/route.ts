import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { getCollectionAlbumForCustomerByBackend } from "@/lib/lottery-backend";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const ip = getRequestIp(request);
  const rateLimitKey = `account_collection:${session.customerId}:${ip}`;
  const rateLimit = await hitRateLimit({ key: rateLimitKey, windowSeconds: 60, maxHits: 30 });
  if (!rateLimit.allowed) {
    logRateLimitRejection({
      endpoint: "GET /api/account/collection",
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

  try {
    const album = await getCollectionAlbumForCustomerByBackend(session.customerId);
    return NextResponse.json(album);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lecture album impossible.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
