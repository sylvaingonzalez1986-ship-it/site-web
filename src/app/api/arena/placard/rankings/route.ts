import { NextResponse } from "next/server";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { getKqPublicLeaderboard } from "@/lib/supabase/kanab-quest-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!await isKqPlayerRequestEnabled()) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }
  try {
    return NextResponse.json(await getKqPublicLeaderboard(), {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch {
    return NextResponse.json({
      seasonCode: "KQ-2026-S1",
      generatedAt: null,
      entries: [],
      unavailable: true,
    }, {
      status: 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
}
