import { NextResponse } from "next/server";
import { getValidatedAdminContext } from "@/lib/admin-guard";
import { updateKqBotteCard } from "@/lib/supabase/kanab-quest-catalog-admin-backend";

export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: Promise<{ cardId: string }> }) {
  if (!await getValidatedAdminContext()) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    const { cardId } = await params;
    const value = await request.json() as Record<string, unknown>;
    if (["name", "rarity", "description", "imageUrl", "advantage", "drawback"].some((key) => typeof value[key] !== "string") || typeof value.isActive !== "boolean") {
      return NextResponse.json({ error: "Carte invalide." }, { status: 400 });
    }
    return NextResponse.json(await updateKqBotteCard({
      cardId, name: String(value.name), rarity: String(value.rarity), description: String(value.description),
      imageUrl: String(value.imageUrl), advantage: String(value.advantage), drawback: String(value.drawback), isActive: value.isActive,
    }));
  } catch { return NextResponse.json({ error: "Enregistrement de la carte impossible." }, { status: 409 }); }
}
