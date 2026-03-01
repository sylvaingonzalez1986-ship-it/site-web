import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import {
  archiveLotteryAlbumCardByBackend,
  updateLotteryAlbumCardByBackend,
} from "@/lib/lottery-backend";
import type { LotteryStickerRarity } from "@/types/lottery";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> },
) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const { cardId } = await params;

  try {
    const payload = (await request.json()) as {
      code: string;
      title: string;
      subtitle?: string | null;
      imageUrl?: string | null;
      seriesLabel?: string | null;
      cardNumber: number;
      rarity: LotteryStickerRarity;
      isActive: boolean;
    };

    const albumCard = await updateLotteryAlbumCardByBackend(cardId, {
      code: payload.code,
      title: payload.title,
      subtitle: payload.subtitle,
      imageUrl: payload.imageUrl,
      seriesLabel: payload.seriesLabel,
      cardNumber: Number(payload.cardNumber),
      rarity: payload.rarity,
      isActive: payload.isActive !== false,
    });

    if (!albumCard) {
      return NextResponse.json({ error: "Carte album introuvable." }, { status: 404 });
    }

    return NextResponse.json({ albumCard });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mise a jour carte album impossible.";
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

  const { cardId } = await params;

  try {
    const archived = await archiveLotteryAlbumCardByBackend(cardId);
    if (!archived) {
      return NextResponse.json({ error: "Carte album introuvable." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Archivage carte album impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
