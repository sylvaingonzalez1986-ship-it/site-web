import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { listLotteryBonusInstancesForCustomerByBackend } from "@/lib/lottery-backend";

export const runtime = "nodejs";

export async function GET() {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  try {
    const bonuses = await listLotteryBonusInstancesForCustomerByBackend(session.customerId);
    return NextResponse.json({ bonuses });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lecture bonus impossible.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
