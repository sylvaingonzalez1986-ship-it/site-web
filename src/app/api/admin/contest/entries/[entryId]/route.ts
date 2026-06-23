import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { getValidatedAdminContext } from "@/lib/admin-guard";
import { rejectOversizedBody } from "@/lib/body-size-guard";
import {
  CONTEST_SCHEMA_MISSING_MESSAGE,
  deleteContestEntry,
  isContestSchemaMissingError,
  updateContestEntry,
} from "@/lib/contest-backend";
import { getContestFeatureDisabledResponse, isContestFeatureEnabledServer } from "@/lib/contest-feature";
import type { ContestEntryInput } from "@/types/contest";

export const runtime = "nodejs";

const ADMIN_CONTEST_ENTRY_BODY_MAX_BYTES = 64 * 1024;

type RouteContext = {
  params: Promise<{ entryId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  if (!isContestFeatureEnabledServer()) {
    return getContestFeatureDisabledResponse();
  }

  const rejected = rejectOversizedBody(request, ADMIN_CONTEST_ENTRY_BODY_MAX_BYTES);
  if (rejected) return rejected;

  const admin = await getValidatedAdminContext();
  if (!admin) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const { entryId } = await context.params;
  const payload = (await request.json().catch(() => null)) as Partial<ContestEntryInput> | null;
  if (!payload) {
    return NextResponse.json({ error: "Payload lot invalide." }, { status: 400 });
  }

  try {
    const entry = await updateContestEntry(entryId, payload);
    logAuditEvent({
      eventType: "contest_entry_updated",
      actorEmail: admin.email,
      metadata: { entryId: entry.id, slug: entry.slug, seasonId: entry.seasonId },
    });
    return NextResponse.json({ entry });
  } catch (error) {
    if (isContestSchemaMissingError(error)) {
      return NextResponse.json({ error: CONTEST_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible de mettre a jour le lot premium." },
      { status: 400 },
    );
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  if (!isContestFeatureEnabledServer()) {
    return getContestFeatureDisabledResponse();
  }

  const admin = await getValidatedAdminContext();
  if (!admin) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const { entryId } = await context.params;

  try {
    const entry = await deleteContestEntry(entryId);
    if (!entry) {
      return NextResponse.json({ error: "Lot introuvable." }, { status: 404 });
    }

    logAuditEvent({
      eventType: "contest_entry_deleted",
      actorEmail: admin.email,
      metadata: { entryId: entry.id, slug: entry.slug, seasonId: entry.seasonId },
    });
    return NextResponse.json({ entry });
  } catch (error) {
    if (isContestSchemaMissingError(error)) {
      return NextResponse.json({ error: CONTEST_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible de supprimer le lot premium." },
      { status: 400 },
    );
  }
}
