import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import {
  createLotteryBonusDefinitionByBackend,
  listLotteryBonusDefinitionsByBackend,
} from "@/lib/lottery-backend";

export const runtime = "nodejs";

export async function GET() {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  try {
    const bonuses = await listLotteryBonusDefinitionsByBackend();
    return NextResponse.json({ bonuses });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lecture cartes bonus impossible.";
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
      description?: string;
      imageUrl?: string;
      quotaPerCycle: number;
      isActive: boolean;
    };

    if (!payload.code || !payload.title || !Number.isFinite(payload.quotaPerCycle)) {
      return NextResponse.json({ error: "Donnees carte bonus invalides." }, { status: 400 });
    }

    const bonus = await createLotteryBonusDefinitionByBackend({
      code: payload.code,
      title: payload.title,
      description: payload.description,
      imageUrl: payload.imageUrl,
      quotaPerCycle: Number(payload.quotaPerCycle),
      isActive: payload.isActive !== false,
    });

    return NextResponse.json({ bonus });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Creation carte bonus impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
