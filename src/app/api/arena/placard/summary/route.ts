import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerIdentityEnabled } from "@/lib/kanab-quest-player-request-access";
import { getArenaPlayerSummary } from "@/lib/supabase/arena-player-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };

export async function GET() {
  try {
    const session = await getCurrentCustomerSessionByBackend("identity");
    if (!await isKqPlayerIdentityEnabled(session)) return NextResponse.json({ error: "Introuvable." }, { status: 404, headers });
    if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401, headers });
    return NextResponse.json(await getArenaPlayerSummary(session.customerId), { headers });
  } catch {
    return NextResponse.json({ error: "Ton activité est momentanément indisponible." }, { status: 503, headers });
  }
}
