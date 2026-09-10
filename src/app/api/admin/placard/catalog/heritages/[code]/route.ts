import { NextResponse } from "next/server";
import { getValidatedAdminContext } from "@/lib/admin-guard";
import { updateKqHeritageCard } from "@/lib/supabase/kanab-quest-catalog-admin-backend";

export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!await getValidatedAdminContext()) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    const { code } = await params;
    const value = await request.json() as Record<string, unknown>;
    if (["name", "timing", "effect", "description", "imageUrl", "advantage", "drawback"].some((key) => typeof value[key] !== "string")
      || typeof value.isActive !== "boolean") {
      return NextResponse.json({ error: "Carte Héritage invalide." }, { status: 400 });
    }
    return NextResponse.json(await updateKqHeritageCard({
      code, name: String(value.name), timing: String(value.timing), effect: String(value.effect), description: String(value.description),
      imageUrl: String(value.imageUrl), advantage: String(value.advantage), drawback: String(value.drawback),
      isActive: value.isActive,
    }));
  } catch (error) {
    const message = error instanceof Error && error.message === "Ce pouvoir est déjà attribué à un autre producteur actif."
      ? error.message
      : "Enregistrement de la carte Héritage impossible.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
