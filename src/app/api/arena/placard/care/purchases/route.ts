import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import { getKqCarePurchaseRegister } from "@/lib/supabase/kanab-quest-care-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(request: Request) {
  if (!await isKqPlayerRequestEnabled()) return NextResponse.json({ error: "Introuvable." }, { status: 404, headers });
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401, headers });
  try {
    return NextResponse.json(await getKqCarePurchaseRegister(session.customerId, new URL(request.url).searchParams.get("before") ?? undefined), { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registre indisponible.";
    const internal = message.startsWith("[supabase:");
    return NextResponse.json({ error: internal ? "Registre momentanément indisponible." : message }, { status: internal ? 503 : 400, headers });
  }
}
