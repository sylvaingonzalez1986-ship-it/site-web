import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import {
  createLotteryAlbumPageByBackend,
  listLotteryAlbumPagesByBackend,
} from "@/lib/lottery-backend";
import type { LotteryStickerRarity } from "@/types/lottery";

export const runtime = "nodejs";

export async function GET() {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  try {
    const albumPages = await listLotteryAlbumPagesByBackend();
    return NextResponse.json({ albumPages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lecture pages album impossible.";
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
      collectionTitle: string;
      rarity: LotteryStickerRarity;
      pageNumber: number;
      isActive: boolean;
      slots?: Array<{ slotIndex: number; cardId?: string | null; label?: string | null }>;
    };

    if (!payload.code || !payload.title || !payload.collectionTitle || !payload.rarity) {
      return NextResponse.json({ error: "Donnees page album invalides." }, { status: 400 });
    }

    const albumPage = await createLotteryAlbumPageByBackend({
      code: payload.code,
      title: payload.title,
      collectionTitle: payload.collectionTitle,
      rarity: payload.rarity,
      pageNumber: Number(payload.pageNumber),
      isActive: payload.isActive !== false,
      slots: payload.slots ?? [],
    });

    return NextResponse.json({ albumPage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Creation page album impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
