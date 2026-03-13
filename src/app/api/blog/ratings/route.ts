import { NextResponse } from "next/server";
import { rejectOversizedBody } from "@/lib/body-size-guard";
import { getBlogRatingStats, upsertBlogRating } from "@/lib/blog-interactions-backend";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";

export const runtime = "nodejs";

function sanitizePostId(value: string | null): string {
  return (value ?? "").trim().slice(0, 80);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const postId = sanitizePostId(url.searchParams.get("postId"));
  if (!postId) {
    return NextResponse.json({ error: "postId requis." }, { status: 400 });
  }

  const session = await getCurrentCustomerSessionByBackend();
  const stats = await getBlogRatingStats(postId, session?.customerId);
  return NextResponse.json(stats);
}

export async function POST(request: Request) {
  const rejected = rejectOversizedBody(request);
  if (rejected) return rejected;

  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as
    | { postId?: string; rating?: number }
    | null;
  const postId = sanitizePostId(payload?.postId ?? null);
  const rating = Number(payload?.rating ?? 0);

  if (!postId || !Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Payload invalide." }, { status: 400 });
  }

  const ip = getRequestIp(request);
  const key = `blog_rating:${ip}:${session.customerId}`;
  const limit = await hitRateLimit({ key, windowSeconds: 60, maxHits: 10 });
  if (!limit.allowed) {
    logRateLimitRejection({
      endpoint: "POST /api/blog/ratings",
      key,
      ip,
      actorEmail: session.customer.email,
      retryAfterSeconds: limit.retryAfterSeconds,
      maxHits: 10,
      windowSeconds: 60,
    });
    return NextResponse.json(
      { error: "Trop de votes. Reessaie plus tard." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  await upsertBlogRating({
    postId,
    customerId: session.customerId,
    rating: Math.round(rating),
  });

  const stats = await getBlogRatingStats(postId, session.customerId);
  return NextResponse.json(stats);
}
