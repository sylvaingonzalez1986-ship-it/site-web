import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { getChanvrierProfile } from "@/lib/supabase/arena-chanvrier-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    const session = await getCurrentCustomerSessionByBackend("identity");
    if (!session) return NextResponse.json({ error: "Connecte-toi pour découvrir le parcours." }, { status: 401, headers });
    if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Parcours indisponible." }, { status: 404, headers });
    const chanvrier = await getChanvrierProfile(session.customerId);
    return NextResponse.json({ userId: session.customerId, chanvrier }, { headers });
  } catch {
    return NextResponse.json({ error: "Le personnage est momentanément indisponible." }, { status: 503, headers });
  }
}
