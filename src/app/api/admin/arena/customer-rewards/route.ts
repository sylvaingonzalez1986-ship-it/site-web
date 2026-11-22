import { readRequestBody } from "@/lib/body-size-guard";
import { NextResponse } from "next/server";
import { getValidatedAdminContext } from "@/lib/admin-guard";
import {
  freezeArenaCustomerRewardSeason,
  getArenaCustomerRewardPool,
  recordArenaPrizeReturn,
  settleArenaCustomerRewards,
} from "@/lib/supabase/arena-customer-rewards-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getValidatedAdminContext();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    return NextResponse.json(await getArenaCustomerRewardPool({ finalizePreviousWeeks: true }), {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Aperçu du pot indisponible.",
    }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const admin = await getValidatedAdminContext();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const boundedBody = await readRequestBody(request);
  if (!boundedBody.ok) return boundedBody.response;
  const payload = await boundedBody.body.json().catch(() => ({})) as {
    action?: "preview" | "freeze" | "settle" | "record-return";
    itemId?: number;
    reference?: string;
    grams?: number;
    execute?: boolean;
  };
  try {
    const action = payload.action ?? "preview";
    if (action === "record-return") {
      const { itemId, grams, reference } = payload;
      if (payload.execute !== true || typeof itemId !== "number" || !Number.isSafeInteger(itemId) || itemId < 1 ||
          typeof grams !== "number" || !Number.isFinite(grams) || grams <= 0 ||
          typeof reference !== "string" || !reference.trim() || reference.trim().length > 160) {
        return NextResponse.json({ error: "Ligne, poids et référence de remboursement confirmés requis." }, { status: 400 });
      }
      return NextResponse.json(await recordArenaPrizeReturn(itemId, reference.trim(), grams));
    }
    const result = action === "freeze"
      ? await freezeArenaCustomerRewardSeason(payload.execute === true)
      : await settleArenaCustomerRewards(action === "settle" && payload.execute === true);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Clôture des récompenses impossible.",
    }, { status: 409 });
  }
}
