import { NextResponse } from "next/server";
import {
  CONTEST_SCHEMA_MISSING_MESSAGE,
  getPublicContestEntries,
  isContestSchemaMissingError,
} from "@/lib/contest-backend";
import { getContestFeatureAccessDeniedResponse } from "@/lib/contest-feature";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = await getContestFeatureAccessDeniedResponse();
  if (denied) {
    return denied;
  }

  try {
    const url = new URL(request.url);
    const season = url.searchParams.get("season") ?? undefined;
    const category = url.searchParams.get("category") ?? undefined;
    const track = url.searchParams.get("track") ?? undefined;

    const payload = await getPublicContestEntries({ seasonCode: season, category, track });
    return NextResponse.json(payload);
  } catch (error) {
    if (isContestSchemaMissingError(error)) {
      return NextResponse.json({ error: CONTEST_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    throw error;
  }
}
