import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { isKqPlayerRequestEnabled } from "@/lib/kanab-quest-player-request-access";
import {
  getKqPlayerCollectionSnapshot,
  getKqPlayerCoreSnapshot,
  getKqPlayerHeritageSnapshot,
  getKqPlayerOwnedBuddies,
} from "@/lib/supabase/kanab-quest-backend";
import { getKqEquipmentRoutePlan } from "@/lib/supabase/kanab-quest-equipment-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = performance.now();
  if (!await isKqPlayerRequestEnabled()) {
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
    routePlanResult,
  ] = await Promise.allSettled([
    getKqPlayerCollectionSnapshot(session.customerId),
    getKqPlayerOwnedBuddies(session.customerId),
    getKqPlayerHeritageSnapshot(session.customerId),
    getKqPlayerCoreSnapshot(session.customerId),
    getKqEquipmentRoutePlan(session.customerId),
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
        name: card.name,
        timing: card.timing,
        effectCode: card.effectCode,
        description: card.description,
        imageUrl: card.imageUrl,
        ownedCopies: card.ownedCopies,
        isActive: card.isActive,
        producerId: card.producerId,
        producerName: card.producerName,
        producerNames: card.producerNames,
      })),
      fragmentBalance: heritage.fragmentBalance,
    } : null,
    routePlan: routePlanResult.status === "fulfilled" ? routePlanResult.value : null,
    playerSession,
    warnings: [
      ...(heritage ? [] : ["Héritages momentanément indisponibles."]),
      ...(routePlanResult.status === "fulfilled" ? [] : ["Objectif de filière momentanément indisponible."]),
    ],
  }, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Server-Timing": `auth;dur=${(authenticatedAt - startedAt).toFixed(1)}, data;dur=${(performance.now() - authenticatedAt).toFixed(1)}`,
    },
  });
}
