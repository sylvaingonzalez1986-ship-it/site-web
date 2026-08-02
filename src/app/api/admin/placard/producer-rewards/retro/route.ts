import { NextResponse } from "next/server";
import { getValidatedAdminContext } from "@/lib/admin-guard";
import { syncKqProducerNotebookRewardBatch } from "@/lib/supabase/kanab-quest-producer-rewards-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!await getValidatedAdminContext()) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  let cursor = 0;
  try {
    const payload = await request.json() as { cursor?: unknown };
    cursor = payload.cursor === undefined ? 0 : Number(payload.cursor);
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  if (!Number.isSafeInteger(cursor) || cursor < 0) return NextResponse.json({ error: "Curseur invalide." }, { status: 400 });
  try {
    return NextResponse.json(await syncKqProducerNotebookRewardBatch(cursor), {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json({ error: "Rétro-attribution impossible." }, { status: 409 });
  }
}
