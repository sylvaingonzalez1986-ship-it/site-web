﻿import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import {
  getLotteryConfigByBackend,
  getLotteryStatsByBackend,
  listLotteryPrizesByBackend,
  updateLotteryConfigByBackend,
} from "@/lib/lottery-backend";

export const runtime = "nodejs";

export async function GET() {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  try {
    const [config, prizes, stats] = await Promise.all([
      getLotteryConfigByBackend(),
      listLotteryPrizesByBackend(),
      getLotteryStatsByBackend(),
    ]);

    return NextResponse.json({ config, prizes, stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lecture loterie impossible.";
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
      ticketThresholdEuros: number;
      isActive: boolean;
    };

    if (!Number.isFinite(payload.ticketThresholdEuros) || typeof payload.isActive !== "boolean") {
      return NextResponse.json({ error: "Configuration loterie invalide." }, { status: 400 });
    }

    const config = await updateLotteryConfigByBackend({
      ticketThresholdEuros: Number(payload.ticketThresholdEuros),
      isActive: payload.isActive,
    });

    const stats = await getLotteryStatsByBackend();

    return NextResponse.json({ config, stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mise a jour loterie impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}


