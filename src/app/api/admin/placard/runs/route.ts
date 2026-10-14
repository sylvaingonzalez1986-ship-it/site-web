import { isKqEnergyMode } from "@/lib/kanab-quest-energy";
import { NextResponse } from "next/server";
import { getValidatedAdminContext } from "@/lib/admin-guard";
import { getKqAdminRunsSnapshot, readKqRunSelection, startKqAdminRun } from "@/lib/supabase/kanab-quest-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request?: Request) {
  const admin = await getValidatedAdminContext();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  let selection;
  try { selection = readKqRunSelection(request); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Sélection invalide." }, { status: 400 }); }
  try {
    return NextResponse.json(await getKqAdminRunsSnapshot(admin.email, selection), {
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
  if (!Array.isArray(body.deckCodes) || !body.deckCodes.every((code) => typeof code === "string")) {
    return NextResponse.json({ error: "Deck invalide." }, { status: 400 });
  }
  const deckCodes = body.deckCodes as string[];
  const cultureTokens = typeof body.cultureTokens === "number" ? body.cultureTokens : 0;
  const heritageCode = typeof body.heritageCode === "string" ? body.heritageCode : undefined;

  if (body.energyMode !== undefined && !isKqEnergyMode(body.energyMode)) return NextResponse.json({ error: "Mode énergétique invalide." }, { status: 400 });
  if (body.campaign !== undefined && typeof body.campaign !== "boolean") return NextResponse.json({ error: "Campagne invalide." }, { status: 400 });
  if ((body.zoneId !== undefined && typeof body.zoneId !== "string") || (body.requestKey !== undefined && typeof body.requestKey !== "string")) return NextResponse.json({ error: "Zone ou clé de lancement invalide." }, { status: 400 });
  try {
    const result = await startKqAdminRun(admin.email, { buddieCode, deckCodes, cultureTokens, heritageCode, energyMode: isKqEnergyMode(body.energyMode) ? body.energyMode : "balanced",
      ...(body.campaign === true ? { campaign: true } : {}),
      zoneId: typeof body.zoneId === "string" ? body.zoneId : undefined, requestKey: typeof body.requestKey === "string" ? body.requestKey : undefined,
      expectedEnergyCents: typeof body.expectedEnergyCents === "number" ? body.expectedEnergyCents : undefined });
    return NextResponse.json(result, {
      status: 201,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Création de partie impossible.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
