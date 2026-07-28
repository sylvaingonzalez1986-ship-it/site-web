import { NextResponse } from "next/server";
import { getValidatedAdminContext } from "@/lib/admin-guard";
import { getKqAdminBattles, lockKqAdminBattle } from "@/lib/supabase/kanab-quest-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getValidatedAdminContext();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    return NextResponse.json({ battles: await getKqAdminBattles(admin.email) }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Duels indisponibles." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const admin = await getValidatedAdminContext();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  let payload: unknown;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const body = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const flowerId = typeof body.flowerId === "string" ? body.flowerId : "";
  const rivalFlowerId = typeof body.rivalFlowerId === "string" ? body.rivalFlowerId : "";
  if (!flowerId || !rivalFlowerId) return NextResponse.json({ error: "Deux Fleurs sont requises." }, { status: 400 });
  try {
    return NextResponse.json(await lockKqAdminBattle(admin.email, flowerId, rivalFlowerId), {
      status: 201, headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Duel impossible." }, { status: 409 });
  }
}
