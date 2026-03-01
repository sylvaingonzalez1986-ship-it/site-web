import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import {
  deactivateLotteryRewardRuleByBackend,
  listLotteryRewardRulesByBackend,
  upsertLotteryRewardRuleByBackend,
} from "@/lib/lottery-backend";
import type { LotteryStickerRarity } from "@/types/lottery";

export const runtime = "nodejs";

export async function GET() {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  try {
    const rewardRules = await listLotteryRewardRulesByBackend();
    return NextResponse.json({ rewardRules });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lecture règles impossible.";
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
      ruleId?: string;
      stickerRarity: LotteryStickerRarity;
      stickersRequired: number;
      rewardDefinitionId: string;
      albumPageId?: string | null;
      isActive: boolean;
      priority: number;
    };

    if (!payload.stickerRarity || !payload.rewardDefinitionId) {
      return NextResponse.json({ error: "Règle loterie invalide." }, { status: 400 });
    }

    const rewardRule = await upsertLotteryRewardRuleByBackend({
      ruleId: payload.ruleId,
      stickerRarity: payload.stickerRarity,
      stickersRequired: Number(payload.stickersRequired),
      rewardDefinitionId: payload.rewardDefinitionId,
      albumPageId: payload.albumPageId,
      isActive: payload.isActive,
      priority: Number(payload.priority),
    });

    return NextResponse.json({ rewardRule });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mise à jour règle impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  try {
    const payload = (await request.json()) as {
      ruleId?: string;
    };

    if (!payload.ruleId) {
      return NextResponse.json({ error: "Regle loterie invalide." }, { status: 400 });
    }

    const success = await deactivateLotteryRewardRuleByBackend(payload.ruleId);
    return NextResponse.json({ success });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Suppression regle impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
