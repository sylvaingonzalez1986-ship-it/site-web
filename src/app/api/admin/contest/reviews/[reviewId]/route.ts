import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { getValidatedAdminContext } from "@/lib/admin-guard";
import { rejectOversizedBody } from "@/lib/body-size-guard";
import {
  CONTEST_SCHEMA_MISSING_MESSAGE,
  isContestSchemaMissingError,
  moderateContestReview,
} from "@/lib/contest-backend";
import { getContestFeatureDisabledResponse, isContestFeatureEnabledServer } from "@/lib/contest-feature";
import type { ContestReviewStatus } from "@/types/contest";

export const runtime = "nodejs";

const ADMIN_CONTEST_REVIEW_MODERATION_BODY_MAX_BYTES = 4 * 1024;

type RouteContext = {
  params: Promise<{ reviewId: string }>;
};

function isModerationStatus(value: string): value is Exclude<ContestReviewStatus, "pending"> {
  return value === "approved" || value === "rejected";
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!isContestFeatureEnabledServer()) {
    return getContestFeatureDisabledResponse();
  }

  const rejected = rejectOversizedBody(request, ADMIN_CONTEST_REVIEW_MODERATION_BODY_MAX_BYTES);
  if (rejected) return rejected;

  const admin = await getValidatedAdminContext();
  if (!admin) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const { reviewId } = await context.params;
  const payload = (await request.json().catch(() => null)) as
    | { status?: string; adminNote?: string; qualityMark?: string }
    | null;

  const status = (payload?.status ?? "").trim();
  if (!isModerationStatus(status)) {
    return NextResponse.json({ error: "Statut de moderation invalide." }, { status: 400 });
  }

  try {
    await moderateContestReview({
      reviewId,
      status,
      adminNote: (payload?.adminNote ?? "").trim().slice(0, 500),
      qualityMark: payload?.qualityMark === "useful" || payload?.qualityMark === "excellent"
        ? payload.qualityMark
        : "",
      reviewedBy: admin.email,
    });
    logAuditEvent({
      eventType: "contest_review_moderated",
      actorEmail: admin.email,
      metadata: { reviewId, status },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isContestSchemaMissingError(error)) {
      return NextResponse.json({ error: CONTEST_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible de moderer l'avis." },
      { status: 400 },
    );
  }
}
