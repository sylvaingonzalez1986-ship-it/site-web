import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import {
  archiveLotteryBonusDefinitionByBackend,
  updateLotteryBonusDefinitionByBackend,
} from "@/lib/lottery-backend";

export const runtime = "nodejs";

export async function PUT(
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

    const bonus = await updateLotteryBonusDefinitionByBackend(bonusId, {
      code: payload.code,
      title: payload.title,
      description: payload.description,
      imageUrl: payload.imageUrl,
      quotaPerCycle: Number(payload.quotaPerCycle),
      isActive: payload.isActive !== false,
    });

    if (!bonus) {
      return NextResponse.json({ error: "Carte bonus introuvable." }, { status: 404 });
    }

    return NextResponse.json({ bonus });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mise a jour carte bonus impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ bonusId: string }> },
) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  try {
    const { bonusId } = await params;
    const success = await archiveLotteryBonusDefinitionByBackend(bonusId);

    if (!success) {
      return NextResponse.json({ error: "Carte bonus introuvable." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Archivage carte bonus impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
