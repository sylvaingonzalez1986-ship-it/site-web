import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import {
  archiveLotteryBonusOptionByBackend,
  updateLotteryBonusOptionByBackend,
} from "@/lib/lottery-backend";
import type { LotteryBonusOption } from "@/types/lottery";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ bonusId: string; optionId: string }> },
) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  try {
    const { optionId } = await params;
    const payload = (await request.json()) as {
      label: string;
      kind: LotteryBonusOption["kind"];
      giftWeightGrams?: number;
      giftProductSku?: string;
      giftLabel?: string;
      customPayload?: Record<string, unknown>;
      sortOrder?: number;
    };

    if (!payload.label || !payload.kind) {
      return NextResponse.json({ error: "Donnees option bonus invalides." }, { status: 400 });
    }

    const option = await updateLotteryBonusOptionByBackend(optionId, {
      label: payload.label,
      kind: payload.kind,
      giftWeightGrams: Number.isFinite(payload.giftWeightGrams) ? Number(payload.giftWeightGrams) : null,
      giftProductSku: payload.giftProductSku,
      giftLabel: payload.giftLabel,
      customPayload: payload.customPayload,
      sortOrder: Number.isFinite(payload.sortOrder) ? Number(payload.sortOrder) : undefined,
    });

    if (!option) {
      return NextResponse.json({ error: "Option bonus introuvable." }, { status: 404 });
    }

    return NextResponse.json({ option });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mise a jour option bonus impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ bonusId: string; optionId: string }> },
) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  try {
    const { optionId } = await params;
    const success = await archiveLotteryBonusOptionByBackend(optionId);

    if (!success) {
      return NextResponse.json({ error: "Option bonus introuvable." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Suppression option bonus impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
