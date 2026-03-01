import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import {
  archiveLotteryAlbumPageByBackend,
  updateLotteryAlbumPageByBackend,
} from "@/lib/lottery-backend";
import type { LotteryStickerRarity } from "@/types/lottery";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const { pageId } = await params;

  try {
    const payload = (await request.json()) as {
      code: string;
      title: string;
      collectionTitle: string;
      rarity: LotteryStickerRarity;
      pageNumber: number;
      isActive: boolean;
      slots: Array<{ slotIndex: number; cardId?: string | null; label?: string | null }>;
    };

    const albumPage = await updateLotteryAlbumPageByBackend(pageId, {
      code: payload.code,
      title: payload.title,
      collectionTitle: payload.collectionTitle,
      rarity: payload.rarity,
      pageNumber: Number(payload.pageNumber),
      isActive: payload.isActive !== false,
      slots: payload.slots ?? [],
    });

    if (!albumPage) {
      return NextResponse.json({ error: "Page album introuvable." }, { status: 404 });
    }

    return NextResponse.json({ albumPage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mise a jour page album impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const { pageId } = await params;

  try {
    const archived = await archiveLotteryAlbumPageByBackend(pageId);
    if (!archived) {
      return NextResponse.json({ error: "Page album introuvable." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Archivage page album impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
