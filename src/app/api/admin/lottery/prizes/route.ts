import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import {
  createLotteryRewardDefinitionByBackend,
  listLotteryRewardDefinitionsByBackend,
} from "@/lib/lottery-backend";
import type { LotteryRewardKind, LotteryRewardLevel } from "@/types/lottery";

export const runtime = "nodejs";

export async function GET() {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  try {
    const rewardDefinitions = await listLotteryRewardDefinitionsByBackend();
    return NextResponse.json({ rewardDefinitions });
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
    };

    if (!payload.code || !payload.level || !payload.kind || !payload.title) {
      return NextResponse.json({ error: "Données lot invalides." }, { status: 400 });
    }

    const rewardDefinition = await createLotteryRewardDefinitionByBackend({
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
    });

    return NextResponse.json({ rewardDefinition });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Création lot impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
