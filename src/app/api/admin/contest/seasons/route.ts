import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { rejectOversizedBody } from "@/lib/body-size-guard";
import {
  CONTEST_SCHEMA_MISSING_MESSAGE,
  createContestSeason,
  getContestSeasons,
  isContestSchemaMissingError,
} from "@/lib/contest-backend";
import { getContestFeatureDisabledResponse, isContestFeatureEnabledServer } from "@/lib/contest-feature";
import { denyIfNotAdminApi, getValidatedAdminContext } from "@/lib/admin-guard";
import type { ContestSeasonInput } from "@/types/contest";

export const runtime = "nodejs";

const ADMIN_CONTEST_SEASON_BODY_MAX_BYTES = 4 * 1024;

export async function GET() {
  if (!isContestFeatureEnabledServer()) {
    return getContestFeatureDisabledResponse();
  }

  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  try {
    const seasons = await getContestSeasons();
    return NextResponse.json({ seasons });
  } catch (error) {
    if (isContestSchemaMissingError(error)) {
      return NextResponse.json({ error: CONTEST_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    throw error;
  }
}

export async function POST(request: Request) {
  if (!isContestFeatureEnabledServer()) {
    return getContestFeatureDisabledResponse();
  }

  const rejected = rejectOversizedBody(request, ADMIN_CONTEST_SEASON_BODY_MAX_BYTES);
  if (rejected) return rejected;

  const admin = await getValidatedAdminContext();
  if (!admin) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as ContestSeasonInput | null;
  if (!payload) {
    return NextResponse.json({ error: "Payload saison invalide." }, { status: 400 });
  }

  try {
    const season = await createContestSeason(payload);
    logAuditEvent({
      eventType: "contest_season_created",
      actorEmail: admin.email,
      metadata: { seasonId: season.id, code: season.code },
    });
    return NextResponse.json({ season });
  } catch (error) {
    if (isContestSchemaMissingError(error)) {
      return NextResponse.json({ error: CONTEST_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible de creer la saison." },
      { status: 400 },
    );
  }
}
