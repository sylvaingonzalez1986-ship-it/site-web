import { NextResponse } from "next/server";
import { getValidatedAdminContext } from "@/lib/admin-guard";
import {
  configureKqProducerRewardCampaign,
  getKqProducerRewardAdminSnapshot,
} from "@/lib/supabase/kanab-quest-producer-rewards-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!await getValidatedAdminContext()) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    return NextResponse.json(await getKqProducerRewardAdminSnapshot(), {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json({ error: "Configuration des parcours indisponible." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!await getValidatedAdminContext()) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  let payload: { producerId?: unknown; heritageCode?: unknown; entryIds?: unknown; activate?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  if (typeof payload.producerId !== "string" || typeof payload.heritageCode !== "string"
    || !Array.isArray(payload.entryIds) || payload.entryIds.some((value) => typeof value !== "string")
    || typeof payload.activate !== "boolean") {
    return NextResponse.json({ error: "Configuration invalide." }, { status: 400 });
  }
  try {
    return NextResponse.json(await configureKqProducerRewardCampaign({
      producerId: payload.producerId,
      heritageCode: payload.heritageCode,
      entryIds: payload.entryIds,
      activate: payload.activate,
    }));
  } catch {
    return NextResponse.json({ error: "Enregistrement du parcours impossible." }, { status: 409 });
  }
}
