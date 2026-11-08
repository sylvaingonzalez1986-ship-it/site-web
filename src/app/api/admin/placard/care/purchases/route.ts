import { NextResponse } from "next/server";
import { getValidatedAdminContext } from "@/lib/admin-guard";
import { findKqUserIdByEmail } from "@/lib/supabase/kanab-quest-backend";
import { getKqCarePurchaseRegister } from "@/lib/supabase/kanab-quest-care-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(request: Request) {
  const admin = await getValidatedAdminContext();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401, headers });
  try {
    const userId = await findKqUserIdByEmail(admin.email);
    if (!userId) throw new Error("Compte collection admin introuvable.");
    return NextResponse.json(await getKqCarePurchaseRegister(userId, new URL(request.url).searchParams.get("before") ?? undefined), { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Registre indisponible." }, { status: 400, headers });
  }
}
