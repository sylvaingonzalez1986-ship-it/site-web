import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import {
  archiveLotteryCardDefinitionByBackend,
  updateLotteryCardDefinitionByBackend,
} from "@/lib/lottery-backend";
import type { LotteryCardRarity } from "@/types/lottery";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  try {
    const { cardId } = await params;
    const payload = (await request.json()) as {
      code: string;
      cardNumber: number;
      name: string;
      rarity: LotteryCardRarity;
      visualPrompt?: string | null;
      description?: string | null;
      imageUrl?: string | null;
      isActive: boolean;
    };

    if (!payload.code || !payload.name || !payload.rarity || !Number.isFinite(payload.cardNumber)) {
      return NextResponse.json({ error: "Donnees carte TCG invalides." }, { status: 400 });
    }

    const card = await updateLotteryCardDefinitionByBackend(cardId, {
      code: payload.code,
      cardNumber: Number(payload.cardNumber),
      name: payload.name,
      rarity: payload.rarity,
      visualPrompt: payload.visualPrompt,
      description: payload.description,
      imageUrl: payload.imageUrl,
      isActive: payload.isActive !== false,
    });

    if (!card) {
      return NextResponse.json({ error: "Carte TCG introuvable." }, { status: 404 });
    }

    return NextResponse.json({ card });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mise a jour carte TCG impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  try {
    const { cardId } = await params;
    const success = await archiveLotteryCardDefinitionByBackend(cardId);

    if (!success) {
      return NextResponse.json({ error: "Carte TCG introuvable." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Archivage carte TCG impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
