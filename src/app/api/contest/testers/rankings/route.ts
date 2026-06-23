import { NextResponse } from "next/server";
import {
  CONTEST_SCHEMA_MISSING_MESSAGE,
  getContestTesterRankings,
  isContestSchemaMissingError,
} from "@/lib/contest-backend";
import { getContestFeatureAccessDeniedResponse } from "@/lib/contest-feature";
import { sanitizePublicContestRankingItem } from "@/lib/contest-public-api";
import type { ContestTesterRankingScope } from "@/types/contest";

export const runtime = "nodejs";

function parseScope(value: string | null): ContestTesterRankingScope {
  return value === "global" ? "global" : "season";
}

export async function GET(request: Request) {
  const denied = await getContestFeatureAccessDeniedResponse();
  if (denied) {
    return denied;
  }

  try {
    const url = new URL(request.url);
    const scope = parseScope(url.searchParams.get("scope"));
    const season = url.searchParams.get("season") ?? undefined;
    const limit = url.searchParams.get("limit");

    const payload = await getContestTesterRankings({
      scope,
      seasonCode: season,
      limit: limit ? Number(limit) : undefined,
    });

    return NextResponse.json({
      ...payload,
      items: payload.items.map(sanitizePublicContestRankingItem),
    });
  } catch (error) {
    if (isContestSchemaMissingError(error)) {
      return NextResponse.json({ error: CONTEST_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    throw error;
  }
}
