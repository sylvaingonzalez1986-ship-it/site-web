import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { getChanvrierProfile } from "@/lib/supabase/arena-chanvrier-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

/** Only the signed-in player's given name and character are sent to their simulated feed. */
export async function GET() {
  try {
    if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404, headers });
    const session = await getCurrentCustomerSessionByBackend();
    if (!session) return NextResponse.json({ error: "Connecte-toi pour retrouver ton personnage." }, { status: 401, headers });
    return NextResponse.json({ firstName: session.customer.firstName, profile: await getChanvrierProfile(session.customerId) }, { headers });
  } catch {
    return NextResponse.json({ error: "Ton personnage est momentanément indisponible." }, { status: 503, headers });
  }
}
