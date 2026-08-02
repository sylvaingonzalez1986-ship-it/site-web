import { NextResponse } from "next/server";
import { getValidatedAdminContext } from "@/lib/admin-guard";
import { updateKqHeritageCard } from "@/lib/supabase/kanab-quest-catalog-admin-backend";

export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!await getValidatedAdminContext()) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    const { code } = await params;
    const value = await request.json() as Record<string, unknown>;
    if (["name", "rarity", "description", "imageUrl", "advantage", "drawback"].some((key) => typeof value[key] !== "string")
      || typeof value.isActive !== "boolean") {
      return NextResponse.json({ error: "Carte Héritage invalide." }, { status: 400 });
    }
    return NextResponse.json(await updateKqHeritageCard({
      code, name: String(value.name), rarity: String(value.rarity), description: String(value.description),
      imageUrl: String(value.imageUrl), advantage: String(value.advantage), drawback: String(value.drawback),
      isActive: value.isActive,
    }));
  } catch {
    return NextResponse.json({ error: "Enregistrement de la carte Héritage impossible." }, { status: 409 });
  }
}
