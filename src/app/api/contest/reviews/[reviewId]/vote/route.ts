import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { rejectOversizedBody } from "@/lib/body-size-guard";
import {
  CONTEST_SCHEMA_MISSING_MESSAGE,
  isContestSchemaMissingError,
  voteContestReview,
} from "@/lib/contest-backend";
import { getContestFeatureAccessDeniedResponse } from "@/lib/contest-feature";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import type { ContestReviewVoteValue } from "@/types/contest";
import { getPublicContestError } from "@/lib/contest-api-error";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ reviewId: string }>;
};

function toVoteValue(value: unknown): ContestReviewVoteValue | null {
  return value === 1 || value === -1 ? value : null;
}

export async function POST(request: Request, context: RouteContext) {
  const denied = await getContestFeatureAccessDeniedResponse();
  if (denied) {
    return denied;
  }

  const rejected = rejectOversizedBody(request, 2 * 1024);
  if (rejected) return rejected;

  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  }

  const ip = getRequestIp(request);
  const keyIp = `contest_review_vote_ip:${ip}`;
  const keyUser = `contest_review_vote_user:${session.customerId}`;

  const [limitIp, limitUser] = await Promise.all([
    hitRateLimit({ key: keyIp, windowSeconds: 10 * 60, maxHits: 40 }),
    hitRateLimit({ key: keyUser, windowSeconds: 10 * 60, maxHits: 40 }),
  ]);

  if (!limitIp.allowed || !limitUser.allowed) {
    const retryAfterSeconds = Math.max(limitIp.retryAfterSeconds, limitUser.retryAfterSeconds);
    logRateLimitRejection({
      endpoint: "POST /api/contest/reviews/[reviewId]/vote",
      key: !limitIp.allowed ? keyIp : keyUser,
      ip,
      actorEmail: session.customer.email,
      retryAfterSeconds,
      maxHits: 40,
      windowSeconds: 10 * 60,
    });
    return NextResponse.json(
      { error: "Trop de votes. Reessaie plus tard." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  const { reviewId } = await context.params;
  const payload = (await request.json().catch(() => null)) as { value?: unknown } | null;
  const value = toVoteValue(payload?.value);
  if (value === null) {
    return NextResponse.json({ error: "Vote invalide." }, { status: 400 });
  }

  try {
    const result = await voteContestReview({
      reviewId,
      voterCustomerId: session.customerId,
      voterEmail: session.customer.email,
      value,
    });

    logAuditEvent({
      eventType: "contest_review_vote",
      actorEmail: session.customer.email,
      ip,
      metadata: {
        customerId: session.customerId,
        reviewId,
        value,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (isContestSchemaMissingError(error)) {
      return NextResponse.json({ error: CONTEST_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json(
      { error: getPublicContestError(error, "Vote impossible.") },
      { status: 400 },
    );
  }
}
