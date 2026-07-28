import { NextResponse } from "next/server";
import { isKqPlayerApiEnabled } from "@/lib/kanab-quest-player-access";
import { getKqPublicLeaderboard } from "@/lib/supabase/kanab-quest-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isKqPlayerApiEnabled()) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }
  try {
    return NextResponse.json(await getKqPublicLeaderboard(), {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
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
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  }
}
