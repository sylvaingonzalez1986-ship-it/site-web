import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { rejectOversizedBody } from "@/lib/body-size-guard";
import {
  CONTEST_SCHEMA_MISSING_MESSAGE,
  createContestEntry,
  getAdminContestEntries,
  isContestSchemaMissingError,
} from "@/lib/contest-backend";
import { getContestFeatureDisabledResponse, isContestFeatureEnabledServer } from "@/lib/contest-feature";
import { denyIfNotAdminApi, getValidatedAdminContext } from "@/lib/admin-guard";
import type { ContestEntryInput } from "@/types/contest";

export const runtime = "nodejs";

const ADMIN_CONTEST_ENTRY_BODY_MAX_BYTES = 64 * 1024;
const ADMIN_CONTEST_ENTRY_LIST_DEFAULT_LIMIT = 200;

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
    const payload = await getAdminContestEntries({
      limit: parseAdminListNumber(url.searchParams.get("limit"), ADMIN_CONTEST_ENTRY_LIST_DEFAULT_LIMIT),
      offset: parseAdminListNumber(url.searchParams.get("offset"), 0),
    });
    return NextResponse.json({
      entries: payload.items,
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

export async function POST(request: Request) {
  if (!isContestFeatureEnabledServer()) {
    return getContestFeatureDisabledResponse();
  }

  const rejected = rejectOversizedBody(request, ADMIN_CONTEST_ENTRY_BODY_MAX_BYTES);
  if (rejected) return rejected;

  const admin = await getValidatedAdminContext();
  if (!admin) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as ContestEntryInput | null;
  if (!payload) {
    return NextResponse.json({ error: "Payload lot invalide." }, { status: 400 });
  }

  try {
    const entry = await createContestEntry(payload);
    logAuditEvent({
      eventType: "contest_entry_created",
      actorEmail: admin.email,
      metadata: { entryId: entry.id, slug: entry.slug, seasonId: entry.seasonId },
    });
    return NextResponse.json({ entry });
  } catch (error) {
    if (isContestSchemaMissingError(error)) {
      return NextResponse.json({ error: CONTEST_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible de creer le lot premium." },
      { status: 400 },
    );
  }
}
