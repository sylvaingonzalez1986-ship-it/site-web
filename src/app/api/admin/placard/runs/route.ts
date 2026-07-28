import { NextResponse } from "next/server";
import { getValidatedAdminContext } from "@/lib/admin-guard";
import { getKqAdminActiveRun, startKqAdminRun } from "@/lib/supabase/kanab-quest-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getValidatedAdminContext();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    return NextResponse.json({ activeRun: await getKqAdminActiveRun(admin.email) }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Culture indisponible." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const admin = await getValidatedAdminContext();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const body = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const buddieCode = typeof body.buddieCode === "string" ? body.buddieCode : "";
  const deckCodes = Array.isArray(body.deckCodes)
    ? body.deckCodes.filter((code): code is string => typeof code === "string")
    : [];
  const cultureTokens = typeof body.cultureTokens === "number" ? body.cultureTokens : 0;
  const heritageCode = typeof body.heritageCode === "string" ? body.heritageCode : undefined;

  try {
    const result = await startKqAdminRun(admin.email, { buddieCode, deckCodes, cultureTokens, heritageCode });
    return NextResponse.json(result, {
      status: 201,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Création de partie impossible.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
