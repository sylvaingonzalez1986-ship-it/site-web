import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerApiEnabled } from "@/lib/kanab-quest-player-access";
import {
  getKqPlayerCollectionSnapshot,
  getKqPlayerCoreSnapshot,
  getKqPlayerHeritageSnapshot,
  getKqPlayerOwnedBuddies,
} from "@/lib/supabase/kanab-quest-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = performance.now();
  if (!isKqPlayerApiEnabled()) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }
  const session = await getCurrentCustomerSessionByBackend("identity");
  const authenticatedAt = performance.now();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const [
    collectionResult,
    buddiesResult,
    heritageResult,
    coreResult,
  ] = await Promise.allSettled([
    getKqPlayerCollectionSnapshot(session.customerId),
    getKqPlayerOwnedBuddies(session.customerId),
    getKqPlayerHeritageSnapshot(session.customerId),
    getKqPlayerCoreSnapshot(session.customerId),
  ] as const);
  if (collectionResult.status === "rejected" || buddiesResult.status === "rejected") {
    return NextResponse.json({ error: "Collection Placard indisponible." }, { status: 503 });
  }
  const heritage = heritageResult.status === "fulfilled" ? heritageResult.value : null;
  const sessionResults = [coreResult] as const;
  const sessionLabels = ["Session de jeu"] as const;
  const sessionWarnings = sessionResults.flatMap((result, index) => result.status === "rejected"
    ? [`${sessionLabels[index]} indisponible.`]
    : []);
  const playerSession = sessionResults.every((result) => result.status === "rejected")
    ? null
    : {
        activeRun: coreResult.status === "fulfilled" ? coreResult.value.activeRun : null,
        flowers: coreResult.status === "fulfilled" ? coreResult.value.flowers : [],
        battles: coreResult.status === "fulfilled" ? coreResult.value.battles : [],
        progress: coreResult.status === "fulfilled" ? coreResult.value.progress : null,
        warnings: sessionWarnings,
      };
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
    playerSession,
    warnings: heritage ? [] : ["Héritages momentanément indisponibles."],
  }, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Server-Timing": `auth;dur=${(authenticatedAt - startedAt).toFixed(1)}, data;dur=${(performance.now() - authenticatedAt).toFixed(1)}`,
    },
  });
}
