import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import {
  createLotteryAlbumCardByBackend,
  listLotteryAlbumCardsByBackend,
} from "@/lib/lottery-backend";
import type { LotteryStickerRarity } from "@/types/lottery";

export const runtime = "nodejs";

export async function GET() {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  try {
    const albumCards = await listLotteryAlbumCardsByBackend();
    return NextResponse.json({ albumCards });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lecture cartes album impossible.";
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
      title: string;
      subtitle?: string | null;
      imageUrl?: string | null;
      seriesLabel?: string | null;
      cardNumber: number;
      rarity: LotteryStickerRarity;
      isActive: boolean;
    };

    if (!payload.code || !payload.title || !payload.rarity) {
      return NextResponse.json({ error: "Donnees carte album invalides." }, { status: 400 });
    }

    const albumCard = await createLotteryAlbumCardByBackend({
      code: payload.code,
      title: payload.title,
      subtitle: payload.subtitle,
      imageUrl: payload.imageUrl,
      seriesLabel: payload.seriesLabel,
      cardNumber: Number(payload.cardNumber),
      rarity: payload.rarity,
      isActive: payload.isActive !== false,
    });

    return NextResponse.json({ albumCard });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Creation carte album impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
