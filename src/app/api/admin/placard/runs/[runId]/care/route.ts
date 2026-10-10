import { NextResponse } from "next/server";
import { getValidatedAdminContext } from "@/lib/admin-guard";
import { findKqUserIdByEmail } from "@/lib/supabase/kanab-quest-backend";
import { applyKqPlayerCare } from "@/lib/supabase/kanab-quest-care-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  const admin = await getValidatedAdminContext();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 }); }
  const body = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  if (typeof body.requestKey !== "string" || (body.action !== "basic" && typeof body.productCode !== "string")
    || (body.action !== undefined && body.action !== "basic") || (body.action === "basic" && body.productCode !== undefined)
    || (body.expectedUpdatedAt !== undefined && typeof body.expectedUpdatedAt !== "string")) {
    return NextResponse.json({ error: "Intervention invalide." }, { status: 400 });
  }
  if (body.action === "basic" && (typeof body.basicPriceCents !== "number" || !Number.isSafeInteger(body.basicPriceCents) || body.basicPriceCents <= 0)) {
    return NextResponse.json({ error: "L’entretien est désormais payant. Actualise le suivi pour consulter son prix avant de l’activer." }, { status: 409 });
  }
  try {
    const userId = await findKqUserIdByEmail(admin.email);
    if (!userId) throw new Error("Compte collection admin introuvable.");
    const { runId } = await context.params;
    return NextResponse.json(await applyKqPlayerCare({
      userId, runId, requestKey: body.requestKey,
      ...(body.action === "basic" ? { action: "basic" as const, basicPriceCents: body.basicPriceCents as number } : { productCode: body.productCode as string }),
      ...(typeof body.expectedUpdatedAt === "string" ? { expectedUpdatedAt: body.expectedUpdatedAt } : {}),
    }), { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Intervention impossible." }, { status: 409 }); }
}
