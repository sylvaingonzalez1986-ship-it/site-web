import { NextResponse } from "next/server";
import { getValidatedAdminContext } from "@/lib/admin-guard";
import {
  freezeArenaCustomerRewardSeason,
  getArenaCustomerRewardPool,
  settleArenaCustomerRewards,
} from "@/lib/supabase/arena-customer-rewards-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getValidatedAdminContext();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    return NextResponse.json(await getArenaCustomerRewardPool({ finalizePreviousWeeks: true }), {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Aperçu du pot indisponible.",
    }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const admin = await getValidatedAdminContext();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const payload = await request.json().catch(() => ({})) as {
    action?: "preview" | "freeze" | "settle";
    execute?: boolean;
  };
  try {
    const action = payload.action ?? "preview";
    const result = action === "freeze"
      ? await freezeArenaCustomerRewardSeason(payload.execute === true)
      : await settleArenaCustomerRewards(action === "settle" && payload.execute === true);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Clôture des récompenses impossible.",
    }, { status: 409 });
  }
}
