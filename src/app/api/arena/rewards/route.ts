import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { NextResponse } from "next/server";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { getArenaCustomerRewardPool } from "@/lib/supabase/arena-customer-rewards-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  try {
    const session = await getCurrentCustomerSessionByBackend("identity");
    return NextResponse.json(await getArenaCustomerRewardPool({ viewerId: session?.customerId }), {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json({ error: "Pot de récompenses momentanément indisponible." }, {
      status: 503,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  }
}
