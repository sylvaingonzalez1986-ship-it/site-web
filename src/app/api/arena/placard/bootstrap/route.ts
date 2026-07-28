import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerApiEnabled } from "@/lib/kanab-quest-player-access";
import {
  getKqPlayerCollectionSnapshot,
  getKqPlayerHeritageSnapshot,
  getKqPlayerOwnedBuddies,
} from "@/lib/supabase/kanab-quest-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isKqPlayerApiEnabled()) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const [collectionResult, buddiesResult, heritageResult] = await Promise.allSettled([
    getKqPlayerCollectionSnapshot(session.customerId),
    getKqPlayerOwnedBuddies(session.customerId),
    getKqPlayerHeritageSnapshot(session.customerId),
  ] as const);
  if (collectionResult.status === "rejected" || buddiesResult.status === "rejected") {
    return NextResponse.json({ error: "Collection Placard indisponible." }, { status: 503 });
  }
  const heritage = heritageResult.status === "fulfilled" ? heritageResult.value : null;
  return NextResponse.json({
    collection: collectionResult.value,
    ownedBuddieCodes: buddiesResult.value.map((buddie) => buddie.code),
    ownedBuddies: buddiesResult.value,
    heritage: heritage ? {
      collectionActive: heritage.collectionActive,
      cards: heritage.cards.map((card) => ({
        code: card.code,
        ownedCopies: card.ownedCopies,
        isActive: card.isActive,
      })),
      fragmentBalance: heritage.fragmentBalance,
    } : null,
    warnings: heritage ? [] : ["Héritages momentanément indisponibles."],
  }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
