﻿import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import {
  deleteLotteryPrizeByBackend,
  updateLotteryPrizeByBackend,
} from "@/lib/lottery-backend";
import type { LotteryPrizeRarity } from "@/types/lottery";

export const runtime = "nodejs";

function normalizeProbabilityInput(value: unknown): number {
  if (value === undefined) {
    return NaN;
  }

  const probability = Number(value);
  if (!Number.isFinite(probability)) {
    return NaN;
  }

  if (probability > 1 && probability <= 100) {
    return probability / 100;
  }

  return probability;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ prizeId: string }> },
) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const { prizeId } = await params;

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

    const prize = await updateLotteryPrizeByBackend(prizeId, {
      name: payload.name,
      description: payload.description,
      rarity: payload.rarity,
      probability: normalizeProbabilityInput(payload.probability),
      imageUrl: payload.imageUrl,
      valueEuros: payload.valueEuros,
      stock: payload.stock,
      isActive: payload.isActive,
    });

    if (!prize) {
      return NextResponse.json({ error: "Lot introuvable." }, { status: 404 });
    }

    return NextResponse.json({ prize });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mise à jour lot impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ prizeId: string }> },
) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const { prizeId } = await params;

  try {
    const deleted = await deleteLotteryPrizeByBackend(prizeId);
    if (!deleted) {
      return NextResponse.json({ error: "Lot introuvable." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Suppression lot impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}




