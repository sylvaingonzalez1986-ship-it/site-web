import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import { createLotteryBonusOptionByBackend } from "@/lib/lottery-backend";
import type { LotteryBonusOption } from "@/types/lottery";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bonusId: string }> },
) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  try {
    const { bonusId } = await params;
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

    const option = await createLotteryBonusOptionByBackend({
      bonusDefinitionId: bonusId,
      label: payload.label,
      kind: payload.kind,
      giftWeightGrams: Number.isFinite(payload.giftWeightGrams) ? Number(payload.giftWeightGrams) : null,
      giftProductSku: payload.giftProductSku,
      giftLabel: payload.giftLabel,
      customPayload: payload.customPayload,
      sortOrder: Number.isFinite(payload.sortOrder) ? Number(payload.sortOrder) : undefined,
    });

    return NextResponse.json({ option });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Creation option bonus impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
