import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerApiEnabled } from "@/lib/kanab-quest-player-access";
import { getKqPlayerFlowerRivals } from "@/lib/supabase/kanab-quest-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ flowerId: string }> }) {
  if (!isKqPlayerApiEnabled()) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const { flowerId } = await context.params;
  try {
    return NextResponse.json({
      rivals: await getKqPlayerFlowerRivals(session.customerId, flowerId),
    }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Matchmaking impossible.";
    if (message.startsWith("[supabase:")) {
      return NextResponse.json({ error: "Matchmaking momentanément indisponible." }, { status: 503 });
    }
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
