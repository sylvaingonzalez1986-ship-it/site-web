import { NextResponse } from "next/server";
import {
  CONTEST_SCHEMA_MISSING_MESSAGE,
  getAdminContestReviews,
  isContestSchemaMissingError,
  parseContestReviewStatus,
} from "@/lib/contest-backend";
import { getContestFeatureDisabledResponse, isContestFeatureEnabledServer } from "@/lib/contest-feature";
import { denyIfNotAdminApi } from "@/lib/admin-guard";

export const runtime = "nodejs";

const ADMIN_CONTEST_REVIEW_LIST_DEFAULT_LIMIT = 200;

function parseAdminListNumber(value: string | null, fallback: number): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.floor(numberValue) : fallback;
}

export async function GET(request: Request) {
  if (!isContestFeatureEnabledServer()) {
    return getContestFeatureDisabledResponse();
  }

  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  try {
    const url = new URL(request.url);
    const status = parseContestReviewStatus(url.searchParams.get("status"));
    const payload = await getAdminContestReviews({
      status,
      limit: parseAdminListNumber(url.searchParams.get("limit"), ADMIN_CONTEST_REVIEW_LIST_DEFAULT_LIMIT),
      offset: parseAdminListNumber(url.searchParams.get("offset"), 0),
    });
    return NextResponse.json({
      reviews: payload.items,
      pagination: {
        total: payload.total,
        limit: payload.limit,
        offset: payload.offset,
        hasMore: payload.hasMore,
      },
    });
  } catch (error) {
    if (isContestSchemaMissingError(error)) {
      return NextResponse.json({ error: CONTEST_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    throw error;
  }
}
