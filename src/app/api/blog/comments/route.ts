import { NextResponse } from "next/server";
import { createBlogComment, getApprovedBlogCommentsByPostId } from "@/lib/blog-interactions-backend";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";

export const runtime = "nodejs";

function sanitizePostId(value: string | null): string {
  return (value ?? "").trim().slice(0, 80);
}

function sanitizeContent(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 2000);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const postId = sanitizePostId(url.searchParams.get("postId"));
  if (!postId) {
    return NextResponse.json({ error: "postId requis." }, { status: 400 });
  }

  const comments = await getApprovedBlogCommentsByPostId(postId);
  return NextResponse.json({ comments });
}

export async function POST(request: Request) {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as
    | { postId?: string; content?: string }
    | null;
  const postId = sanitizePostId(payload?.postId ?? null);
  const content = sanitizeContent(payload?.content);

  if (!postId || content.length < 5) {
    return NextResponse.json({ error: "Commentaire invalide (min 5 caracteres)." }, { status: 400 });
  }

  const ip = getRequestIp(request);
  const keyIp = `blog_comment_ip:${ip}`;
  const keyUser = `blog_comment_user:${session.customerId}`;

  const [limitIp, limitUser] = await Promise.all([
    hitRateLimit({ key: keyIp, windowSeconds: 10 * 60, maxHits: 3 }),
    hitRateLimit({ key: keyUser, windowSeconds: 10 * 60, maxHits: 3 }),
  ]);

  if (!limitIp.allowed || !limitUser.allowed) {
    const retryAfterSeconds = Math.max(limitIp.retryAfterSeconds, limitUser.retryAfterSeconds);
    logRateLimitRejection({
      endpoint: "POST /api/blog/comments",
      key: !limitIp.allowed ? keyIp : keyUser,
      ip,
      actorEmail: session.customer.email,
      retryAfterSeconds,
      maxHits: 3,
      windowSeconds: 10 * 60,
    });
    return NextResponse.json(
      { error: "Trop de commentaires. Reessaie plus tard." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  await createBlogComment({
    postId,
    customerId: session.customerId,
    content,
  });

  return NextResponse.json({ ok: true, message: "Commentaire soumis (validation en cours)." });
}
