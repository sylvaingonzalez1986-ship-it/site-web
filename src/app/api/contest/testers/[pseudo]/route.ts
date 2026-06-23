import { NextResponse } from "next/server";
import {
  CONTEST_SCHEMA_MISSING_MESSAGE,
  getPublicContestTesterProfile,
  isContestSchemaMissingError,
} from "@/lib/contest-backend";
import { getContestFeatureAccessDeniedResponse } from "@/lib/contest-feature";
import { sanitizePublicContestTesterProfile } from "@/lib/contest-public-api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ pseudo: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const denied = await getContestFeatureAccessDeniedResponse();
  if (denied) {
    return denied;
  }

  try {
    const { pseudo } = await context.params;
    const url = new URL(request.url);
    const season = url.searchParams.get("season") ?? undefined;
    const limit = url.searchParams.get("limit");

    const profile = await getPublicContestTesterProfile({
      pseudo,
      seasonCode: season,
      limit: limit ? Number(limit) : undefined,
    });

    if (!profile) {
      return NextResponse.json({ error: "Profil testeur introuvable." }, { status: 404 });
    }

    return NextResponse.json(sanitizePublicContestTesterProfile(profile));
  } catch (error) {
    if (isContestSchemaMissingError(error)) {
      return NextResponse.json({ error: CONTEST_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    throw error;
  }
}
