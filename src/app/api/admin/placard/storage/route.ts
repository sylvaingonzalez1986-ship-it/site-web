import { NextResponse } from "next/server";
import { getValidatedAdminContext } from "@/lib/admin-guard";
import { findKqUserIdByEmail } from "@/lib/supabase/kanab-quest-backend";
import { getKqStorageSnapshot, handleKqStorageAction } from "@/lib/supabase/kanab-quest-storage-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof Error ? error.message : "Stockage indisponible." }, { status: 400, headers });
}
export async function GET() {
  const admin = await getValidatedAdminContext();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    const userId = await findKqUserIdByEmail(admin.email);
    if (!userId) throw new Error("Compte collection admin introuvable.");
    return NextResponse.json(await getKqStorageSnapshot(userId), { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  const admin = await getValidatedAdminContext();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
  try {
    const userId = await findKqUserIdByEmail(admin.email);
    if (!userId) throw new Error("Compte collection admin introuvable.");
    return NextResponse.json(await handleKqStorageAction(userId, body as Record<string, unknown>), { headers });
  } catch (error) { return failure(error); }
}
