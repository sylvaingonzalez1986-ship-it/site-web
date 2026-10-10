import { NextResponse } from "next/server";
import { getValidatedAdminContext } from "@/lib/admin-guard";
import { findKqUserIdByEmail } from "@/lib/supabase/kanab-quest-backend";
import { getKqCareShopSnapshot, purchaseKqCareProduct } from "@/lib/supabase/kanab-quest-care-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET() {
  const admin = await getValidatedAdminContext();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    const userId = await findKqUserIdByEmail(admin.email);
    if (!userId) throw new Error("Compte collection admin introuvable.");
    return NextResponse.json(await getKqCareShopSnapshot(userId), { headers });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Suivi indisponible." }, { status: 400 }); }
}

export async function POST(request: Request) {
  const admin = await getValidatedAdminContext();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 }); }
  const body = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  if (typeof body.productCode !== "string" || typeof body.requestKey !== "string" || typeof body.quantity !== "number") {
    return NextResponse.json({ error: "Achat invalide." }, { status: 400 });
  }
  try {
    const userId = await findKqUserIdByEmail(admin.email);
    if (!userId) throw new Error("Compte collection admin introuvable.");
    return NextResponse.json(await purchaseKqCareProduct({ userId, productCode: body.productCode, quantity: body.quantity, requestKey: body.requestKey }), { headers });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Achat impossible." }, { status: 400 }); }
}
