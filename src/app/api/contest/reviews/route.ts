import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { rejectOversizedBody } from "@/lib/body-size-guard";
import {
  CONTEST_SCHEMA_MISSING_MESSAGE,
  getContestReviewForCustomer,
  isContestSchemaMissingError,
  submitContestReview,
  updateContestReview,
} from "@/lib/contest-backend";
import { getContestFeatureAccessDeniedResponse } from "@/lib/contest-feature";
import { sanitizeViewerContestReview } from "@/lib/contest-public-api";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { getRequestIp, hitRateLimit, logRateLimitRejection } from "@/lib/security-rate-limit";
import type { ContestReviewSubmissionInput } from "@/types/contest";
import { getPublicContestError } from "@/lib/contest-api-error";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = await getContestFeatureAccessDeniedResponse();
  if (denied) {
    return denied;
  }

  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ review: null, error: "Connexion requise." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const entryId = (url.searchParams.get("entryId") ?? "").trim();
    if (!entryId) {
      return NextResponse.json({ error: "entryId requis." }, { status: 400 });
    }

    const review = await getContestReviewForCustomer(entryId, session.customerId);
    return NextResponse.json({ review: review ? sanitizeViewerContestReview(review) : null });
  } catch (error) {
    if (isContestSchemaMissingError(error)) {
      return NextResponse.json({ error: CONTEST_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    throw error;
  }
}

export async function POST(request: Request) {
  const denied = await getContestFeatureAccessDeniedResponse();
  if (denied) {
    return denied;
  }

  const rejected = rejectOversizedBody(request, 24 * 1024);
  if (rejected) return rejected;

  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  }

  const ip = getRequestIp(request);
  const keyIp = `contest_review_ip:${ip}`;
  const keyUser = `contest_review_user:${session.customerId}`;

  const [limitIp, limitUser] = await Promise.all([
    hitRateLimit({ key: keyIp, windowSeconds: 10 * 60, maxHits: 4 }),
    hitRateLimit({ key: keyUser, windowSeconds: 10 * 60, maxHits: 4 }),
  ]);

  if (!limitIp.allowed || !limitUser.allowed) {
    const retryAfterSeconds = Math.max(limitIp.retryAfterSeconds, limitUser.retryAfterSeconds);
    logRateLimitRejection({
      endpoint: "POST /api/contest/reviews",
      key: !limitIp.allowed ? keyIp : keyUser,
      ip,
      actorEmail: session.customer.email,
      retryAfterSeconds,
      maxHits: 4,
      windowSeconds: 10 * 60,
    });
    return NextResponse.json(
      { error: "Trop d'avis soumis. Reessaie plus tard." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  const payload = (await request.json().catch(() => null)) as ContestReviewSubmissionInput | null;
  if (!payload) {
    return NextResponse.json({ error: "Payload invalide." }, { status: 400 });
  }

  try {
    const review = await submitContestReview({
      customerId: session.customerId,
      customerEmail: session.customer.email,
      payload,
    });
    logAuditEvent({
      eventType: "contest_review_submit",
      actorEmail: session.customer.email,
      ip,
      metadata: {
        customerId: session.customerId,
        entryId: review.entryId,
        reviewId: review.id,
      },
    });

    return NextResponse.json({
      review: sanitizeViewerContestReview(review),
      message: "Avis soumis. Il sera visible apres moderation.",
    });
  } catch (error) {
    if (isContestSchemaMissingError(error)) {
      return NextResponse.json({ error: CONTEST_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json(
      { error: getPublicContestError(error, "Impossible de soumettre l'avis.") },
      { status: 400 },
    );
  }
}

export async function PUT(request: Request) {
  const denied = await getContestFeatureAccessDeniedResponse();
  if (denied) {
    return denied;
  }

  const rejected = rejectOversizedBody(request, 24 * 1024);
  if (rejected) return rejected;

  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  }

  const ip = getRequestIp(request);
  const keyIp = `contest_review_edit_ip:${ip}`;
  const keyUser = `contest_review_edit_user:${session.customerId}`;

  const [limitIp, limitUser] = await Promise.all([
    hitRateLimit({ key: keyIp, windowSeconds: 10 * 60, maxHits: 6 }),
    hitRateLimit({ key: keyUser, windowSeconds: 10 * 60, maxHits: 6 }),
  ]);

  if (!limitIp.allowed || !limitUser.allowed) {
    const retryAfterSeconds = Math.max(limitIp.retryAfterSeconds, limitUser.retryAfterSeconds);
    logRateLimitRejection({
      endpoint: "PUT /api/contest/reviews",
      key: !limitIp.allowed ? keyIp : keyUser,
      ip,
      actorEmail: session.customer.email,
      retryAfterSeconds,
      maxHits: 6,
      windowSeconds: 10 * 60,
    });
    return NextResponse.json(
      { error: "Trop de modifications. Reessaie plus tard." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  const payload = (await request.json().catch(() => null)) as ContestReviewSubmissionInput | null;
  if (!payload) {
    return NextResponse.json({ error: "Payload invalide." }, { status: 400 });
  }

  try {
    const review = await updateContestReview({
      customerId: session.customerId,
      customerEmail: session.customer.email,
      payload,
    });
    logAuditEvent({
      eventType: "contest_review_update",
      actorEmail: session.customer.email,
      ip,
      metadata: {
        customerId: session.customerId,
        entryId: review.entryId,
        reviewId: review.id,
      },
    });

    return NextResponse.json({
      review: sanitizeViewerContestReview(review),
      message: "Avis modifie. Il reste en moderation.",
    });
  } catch (error) {
    if (isContestSchemaMissingError(error)) {
      return NextResponse.json({ error: CONTEST_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json(
      { error: getPublicContestError(error, "Impossible de modifier l'avis.") },
      { status: 400 },
    );
  }
}
