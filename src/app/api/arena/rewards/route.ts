import { NextResponse } from "next/server";
import { isKqPlayerApiEnabled } from "@/lib/kanab-quest-player-access";
import { getArenaCustomerRewardPool } from "@/lib/supabase/arena-customer-rewards-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isKqPlayerApiEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  try {
    return NextResponse.json(await getArenaCustomerRewardPool(), {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" },
    });
  } catch {
    return NextResponse.json({ error: "Pot de récompenses momentanément indisponible." }, {
      status: 503,
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" },
    });
  }
}
