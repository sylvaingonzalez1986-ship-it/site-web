import { NextResponse } from "next/server";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { getKqPublicArenaLeaderboard } from "@/lib/supabase/kanab-quest-backend";
import { ARENA_FORMULA_VERSION } from "@/lib/arena-ranking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  try {
    return NextResponse.json(await getKqPublicArenaLeaderboard(), {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json({ entries: [], unavailable: true, formulaVersion: ARENA_FORMULA_VERSION }, {
      status: 503,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  }
}
