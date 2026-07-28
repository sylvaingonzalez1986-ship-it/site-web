import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerApiEnabled } from "@/lib/kanab-quest-player-access";
import { getKqPlayerCollectionSnapshot, getKqPlayerOwnedBuddieCodes } from "@/lib/supabase/kanab-quest-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isKqPlayerApiEnabled()) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    const [collection, ownedBuddieCodes] = await Promise.all([
      getKqPlayerCollectionSnapshot(session.customerId),
      getKqPlayerOwnedBuddieCodes(session.customerId),
    ]);
    return NextResponse.json({ collection, ownedBuddieCodes }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json({ error: "Collection Placard indisponible." }, { status: 503 });
  }
}
