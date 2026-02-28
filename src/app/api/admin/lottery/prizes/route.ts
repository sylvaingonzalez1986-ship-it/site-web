﻿import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import {
  createLotteryPrizeByBackend,
  listLotteryPrizesByBackend,
} from "@/lib/lottery-backend";
import type { LotteryPrizeRarity } from "@/types/lottery";

export const runtime = "nodejs";

function normalizeProbabilityInput(value: unknown): number {
  const probability = Number(value);
  if (!Number.isFinite(probability)) {
    return NaN;
  }

  if (probability > 1 && probability <= 100) {
    return probability / 100;
  }

  return probability;
}

export async function GET() {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  try {
    const prizes = await listLotteryPrizesByBackend();
    return NextResponse.json({ prizes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lecture lots impossible.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  try {
    const payload = (await request.json()) as {
      name: string;
      description: string;
      rarity: LotteryPrizeRarity;
      probability: number;
      imageUrl: string;
      valueEuros: number;
      stock: number | null;
      isActive: boolean;
    };

    if (!payload.name || !payload.rarity || !Number.isFinite(payload.valueEuros)) {
      return NextResponse.json({ error: "Données lot invalides." }, { status: 400 });
    }

    const prize = await createLotteryPrizeByBackend({
      name: payload.name,
      description: payload.description,
      rarity: payload.rarity,
      probability: normalizeProbabilityInput(payload.probability),
      imageUrl: payload.imageUrl,
      valueEuros: Number(payload.valueEuros),
      stock: payload.stock,
      isActive: payload.isActive,
    });

    return NextResponse.json({ prize });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Création lot impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}


