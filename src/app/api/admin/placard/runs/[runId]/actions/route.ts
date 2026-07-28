import { NextResponse } from "next/server";
import { getValidatedAdminContext } from "@/lib/admin-guard";
import { applyKqAdminRunAction, type KqRunAction } from "@/lib/supabase/kanab-quest-backend";

const ACTIONS = new Set<KqRunAction>(["roll", "resolve", "advance", "redraw", "heritage", "heritage-swap"]);
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  const admin = await getValidatedAdminContext();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  let payload: unknown;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const body = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const value = body.action;
  if (typeof value !== "string" || !ACTIONS.has(value as KqRunAction)) {
    return NextResponse.json({ error: "Action invalide." }, { status: 400 });
  }
  try {
    const { runId } = await context.params;
    const options = value === "heritage-swap"
      ? { handIndex: Number(body.handIndex), reserveIndex: Number(body.reserveIndex) }
      : undefined;
    if (value === "heritage-swap" && (!Number.isInteger(options?.handIndex) || !Number.isInteger(options?.reserveIndex))) {
      return NextResponse.json({ error: "Emplacements de cartes invalides." }, { status: 400 });
    }
    return NextResponse.json(await applyKqAdminRunAction(admin.email, runId, value as KqRunAction, options), {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Action impossible." }, { status: 409 });
  }
}
