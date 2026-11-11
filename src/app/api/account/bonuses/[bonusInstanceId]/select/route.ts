import { readRequestBody } from "@/lib/body-size-guard";
import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { selectLotteryBonusOptionForCustomerByBackend } from "@/lib/lottery-backend";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bonusInstanceId: string }> },
) {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  try {
    const { bonusInstanceId } = await params;
    const boundedBody = await readRequestBody(request);
    if (!boundedBody.ok) return boundedBody.response;
    const payload = (await boundedBody.body.json()) as { optionId?: string };

    if (!payload.optionId) {
      return NextResponse.json({ error: "Option bonus manquante." }, { status: 400 });
    }

    const bonus = await selectLotteryBonusOptionForCustomerByBackend({
      userId: session.customerId,
      bonusInstanceId,
      optionId: payload.optionId,
    });

    return NextResponse.json({ bonus });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Selection bonus impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
