import { NextResponse } from "next/server";
import { getValidatedAdminContext } from "@/lib/admin-guard";
import { playKqAdminCard } from "@/lib/supabase/kanab-quest-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  const admin = await getValidatedAdminContext();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const body = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const cardCode = typeof body.cardCode === "string" ? body.cardCode : "";
  const { runId } = await context.params;
  if (!cardCode) return NextResponse.json({ error: "Carte manquante." }, { status: 400 });

  try {
    const result = await playKqAdminCard(admin.email, runId, cardCode);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Utilisation de carte impossible.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
