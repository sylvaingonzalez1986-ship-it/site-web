import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import {
  createLotteryCardDefinitionByBackend,
  listLotteryCardDefinitionsByBackend,
} from "@/lib/lottery-backend";
import type { LotteryCardRarity } from "@/types/lottery";

export const runtime = "nodejs";

export async function GET() {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  try {
    const cards = await listLotteryCardDefinitionsByBackend();
    return NextResponse.json({ cards });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lecture cartes TCG impossible.";
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

    const card = await createLotteryCardDefinitionByBackend({
      code: payload.code,
      cardNumber: Number(payload.cardNumber),
      name: payload.name,
      rarity: payload.rarity,
      visualPrompt: payload.visualPrompt,
      description: payload.description,
      imageUrl: payload.imageUrl,
      isActive: payload.isActive !== false,
    });

    return NextResponse.json({ card });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Creation carte TCG impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
