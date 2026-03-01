import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import {
  archiveLotteryRewardDefinitionByBackend,
  updateLotteryRewardDefinitionByBackend,
} from "@/lib/lottery-backend";
import type { LotteryRewardKind, LotteryRewardLevel } from "@/types/lottery";

export const runtime = "nodejs";

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
      code: string;
      level: LotteryRewardLevel;
      kind: LotteryRewardKind;
      title: string;
      description: string;
      imageUrl?: string;
      discountPercent?: number | null;
      giftWeightGrams?: number | null;
      giftProductSku?: string | null;
      giftLabel?: string | null;
      customPayload?: Record<string, unknown>;
      isActive: boolean;
      replacementRewardDefinitionId?: string | null;
    };

    const rewardDefinition = await updateLotteryRewardDefinitionByBackend(prizeId, {
      code: payload.code,
      level: payload.level,
      kind: payload.kind,
      title: payload.title,
      description: payload.description,
      imageUrl: payload.imageUrl,
      discountPercent: payload.discountPercent,
      giftWeightGrams: payload.giftWeightGrams,
      giftProductSku: payload.giftProductSku,
      giftLabel: payload.giftLabel,
      customPayload: payload.customPayload,
      isActive: payload.isActive,
      replacementRewardDefinitionId: payload.replacementRewardDefinitionId,
    });

    if (!rewardDefinition) {
      return NextResponse.json({ error: "Lot introuvable." }, { status: 404 });
    }

    return NextResponse.json({ rewardDefinition });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mise à jour lot impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ prizeId: string }> },
) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const { prizeId } = await params;

  try {
    const payload = (await request.json().catch(() => null)) as
      | { replacementRewardDefinitionId?: string | null }
      | null;
    const archived = await archiveLotteryRewardDefinitionByBackend({
      rewardId: prizeId,
      replacementRewardDefinitionId: payload?.replacementRewardDefinitionId,
    });
    if (!archived) {
      return NextResponse.json({ error: "Lot introuvable." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Suppression lot impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
