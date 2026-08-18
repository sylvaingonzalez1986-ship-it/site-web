import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerApiEnabled } from "@/lib/kanab-quest-player-access";
import { getKqPlayerHeritageSnapshot } from "@/lib/supabase/kanab-quest-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isKqPlayerApiEnabled()) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }
  const session = await getCurrentCustomerSessionByBackend("identity");
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    const snapshot = await getKqPlayerHeritageSnapshot(session.customerId);
    return NextResponse.json({
      collectionActive: snapshot.collectionActive,
      fragmentBalance: snapshot.fragmentBalance,
      cards: snapshot.cards.map((card) => ({
        code: card.code,
        name: card.name,
        description: card.description,
        imageUrl: card.imageUrl,
        isActive: card.isActive,
        ownedCopies: card.ownedCopies,
        producerNames: card.producerNames,
      })),
    }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json({ error: "Collection Héritage indisponible." }, { status: 503 });
  }
}
