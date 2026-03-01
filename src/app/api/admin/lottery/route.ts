import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import {
  getLotteryConfigByBackend,
  getLotteryStatsByBackend,
  listLotteryCardDefinitionsByBackend,
  updateLotteryConfigByBackend,
} from "@/lib/lottery-backend";
import type { LotteryConfig } from "@/types/lottery";

export const runtime = "nodejs";

export async function GET() {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  try {
    const defaultConfig: LotteryConfig = {
      eurosPerTicket: 5,
      maxTicketsPerOrder: 4,
      collectionTitle: "Hemp Heroes 2026 Collection",
      albumSubtitle: "Ta collection de cartes. Complete chaque page pour debloquer ses recompenses.",
      albumBoosterTitle: "packs a ouvrir",
      albumBoosterDescription: "Ouvre un booster depuis l'album pour reveler les 3 cartes sans quitter cette page.",
      cardWeights: {
        common: 33,
        silver: 10,
        gold: 5,
        epic: 3,
        legendary: 1,
      },
      isActive: true,
      updatedAt: new Date().toISOString(),
    };

    const [configResult, cardsResult, statsResult] = await Promise.allSettled([
      getLotteryConfigByBackend(),
      listLotteryCardDefinitionsByBackend(),
      getLotteryStatsByBackend(),
    ]);

    if (cardsResult.status === "rejected") {
      throw cardsResult.reason;
    }

    const warnings: string[] = [];

    const config =
      configResult.status === "fulfilled"
        ? configResult.value
        : (() => {
            warnings.push(
              configResult.reason instanceof Error
                ? configResult.reason.message
                : "Configuration loterie indisponible.",
            );
            return defaultConfig;
          })();

    const stats =
      statsResult.status === "fulfilled"
        ? statsResult.value
        : (() => {
            warnings.push(
              statsResult.reason instanceof Error
                ? statsResult.reason.message
                : "Statistiques loterie indisponibles.",
            );
            return null;
          })();

    return NextResponse.json({
      config,
      cards: cardsResult.value,
      stats,
      warning: warnings.length > 0 ? warnings.join(" | ") : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lecture loterie impossible.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  try {
    const payload = (await request.json()) as {
      eurosPerTicket: number;
      maxTicketsPerOrder: number;
      collectionTitle: string;
      albumSubtitle: string;
      albumBoosterTitle: string;
      albumBoosterDescription: string;
      commonWeight: number;
      silverWeight: number;
      goldWeight: number;
      epicWeight: number;
      legendaryWeight: number;
      isActive: boolean;
    };

    if (
      !Number.isFinite(payload.eurosPerTicket) ||
      !Number.isFinite(payload.maxTicketsPerOrder) ||
      !Number.isFinite(payload.commonWeight) ||
      !Number.isFinite(payload.silverWeight) ||
      !Number.isFinite(payload.goldWeight) ||
      !Number.isFinite(payload.epicWeight) ||
      !Number.isFinite(payload.legendaryWeight) ||
      typeof payload.collectionTitle !== "string" ||
      typeof payload.albumSubtitle !== "string" ||
      typeof payload.albumBoosterTitle !== "string" ||
      typeof payload.albumBoosterDescription !== "string" ||
      typeof payload.isActive !== "boolean"
    ) {
      return NextResponse.json({ error: "Configuration loterie invalide." }, { status: 400 });
    }

    const config = await updateLotteryConfigByBackend({
      eurosPerTicket: Number(payload.eurosPerTicket),
      maxTicketsPerOrder: Number(payload.maxTicketsPerOrder),
      collectionTitle: payload.collectionTitle,
      albumSubtitle: payload.albumSubtitle,
      albumBoosterTitle: payload.albumBoosterTitle,
      albumBoosterDescription: payload.albumBoosterDescription,
      commonWeight: Number(payload.commonWeight),
      silverWeight: Number(payload.silverWeight),
      goldWeight: Number(payload.goldWeight),
      epicWeight: Number(payload.epicWeight),
      legendaryWeight: Number(payload.legendaryWeight),
      isActive: payload.isActive,
    });

    const stats = await getLotteryStatsByBackend();

    return NextResponse.json({ config, stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mise a jour loterie impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
