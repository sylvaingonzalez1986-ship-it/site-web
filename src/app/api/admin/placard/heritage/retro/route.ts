import { NextResponse } from "next/server";
import { getValidatedAdminContext } from "@/lib/admin-guard";
import { awardKqHeritagePurchaseBatch } from "@/lib/supabase/kanab-quest-heritage-purchase-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await getValidatedAdminContext();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  let cursor = 0;
  try {
    const payload = await request.json() as { cursor?: unknown };
    if (payload.cursor !== undefined) {
      cursor = Number(payload.cursor);
      if (!Number.isSafeInteger(cursor) || cursor < 0) {
        return NextResponse.json({ error: "Curseur de rétro-attribution invalide." }, { status: 400 });
      }
    }
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  try {
    return NextResponse.json(await awardKqHeritagePurchaseBatch(cursor), {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Rétro-attribution Héritage impossible.",
    }, { status: 409 });
  }
}
