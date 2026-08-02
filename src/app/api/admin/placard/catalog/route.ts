import { NextResponse } from "next/server";
import { getValidatedAdminContext } from "@/lib/admin-guard";
import { getKqBotteCatalogAdmin, updateKqBotteCollection } from "@/lib/supabase/kanab-quest-catalog-admin-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!await getValidatedAdminContext()) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try { return NextResponse.json(await getKqBotteCatalogAdmin(), { headers: { "Cache-Control": "private, no-store" } }); }
  catch { return NextResponse.json({ error: "Catalogue La Botte indisponible." }, { status: 503 }); }
}

export async function PUT(request: Request) {
  if (!await getValidatedAdminContext()) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    const value = await request.json() as Record<string, unknown>;
    if (typeof value.title !== "string" || typeof value.description !== "string" || typeof value.imageUrl !== "string" || typeof value.isActive !== "boolean") {
      return NextResponse.json({ error: "Collection invalide." }, { status: 400 });
    }
    return NextResponse.json(await updateKqBotteCollection({ title: value.title, description: value.description, imageUrl: value.imageUrl, isActive: value.isActive }));
  } catch { return NextResponse.json({ error: "Enregistrement impossible." }, { status: 409 }); }
}
