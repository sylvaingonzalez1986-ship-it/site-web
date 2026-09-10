import { NextResponse } from "next/server";
import { getValidatedAdminContext } from "@/lib/admin-guard";
import {
  buildKqRetroPreviewFingerprint,
  isKqRetroExecutionAllowed,
  KQ_RETRO_EXECUTION_CONFIRMATION,
} from "@/lib/kanab-quest-retro-execution";
import { getKqAdminNotebookRewardPreview } from "@/lib/supabase/kanab-quest-backend";
import {
  previewKqNotebookRewardBatch,
  syncKqNotebookRewardBatch,
} from "@/lib/supabase/kanab-quest-notebook-rewards-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getValidatedAdminContext();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    return NextResponse.json(await getKqAdminNotebookRewardPreview(admin.email), {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Aperçu des récompenses indisponible.",
    }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const admin = await getValidatedAdminContext();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  let cursor = 0;
  let execute = false;
  let confirmation = "";
  let previewFingerprint = "";
  try {
    const payload = await request.json() as {
      cursor?: unknown;
      execute?: unknown;
      confirmation?: unknown;
      previewFingerprint?: unknown;
    };
    if (payload.cursor !== undefined) {
      cursor = Number(payload.cursor);
      if (!Number.isSafeInteger(cursor) || cursor < 0) {
        return NextResponse.json({ error: "Curseur de rétro-attribution invalide." }, { status: 400 });
      }
    }
    execute = payload.execute === true;
    confirmation = typeof payload.confirmation === "string" ? payload.confirmation : "";
    previewFingerprint = typeof payload.previewFingerprint === "string" ? payload.previewFingerprint : "";
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const writeAllowed = isKqRetroExecutionAllowed();
  if (execute && !writeAllowed) {
    return NextResponse.json({ error: "Les écritures de rétro-attribution sont verrouillées." }, { status: 409 });
  }
  if (execute && confirmation !== KQ_RETRO_EXECUTION_CONFIRMATION) {
    return NextResponse.json({ error: "Confirmation d’écriture invalide." }, { status: 400 });
  }
  try {
    const preview = await previewKqNotebookRewardBatch(cursor);
    const currentFingerprint = buildKqRetroPreviewFingerprint("notebook", cursor, preview);
    if (execute && previewFingerprint !== currentFingerprint) {
      return NextResponse.json({
        error: "La simulation Carnet a changé. Relancez l’aperçu avant toute écriture.",
      }, { status: 409 });
    }
    const result = execute ? await syncKqNotebookRewardBatch(cursor) : preview;
    return NextResponse.json({
      mode: execute ? "execute" : "preview",
      cursor,
      writeAllowed,
      previewFingerprint: currentFingerprint,
      ...result,
    }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Rétro-attribution Carnet impossible.",
    }, { status: 409 });
  }
}
