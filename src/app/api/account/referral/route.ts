import { NextResponse } from "next/server";
import { getCustomerByIdByBackend, getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { bindReferralCodeByBackend, getReferralSummaryByBackend } from "@/lib/referral-backend";

export async function GET() {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const summary = await getReferralSummaryByBackend(session.customerId);
  return NextResponse.json({ summary });
}

export async function POST(request: Request) {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as { code?: string };
    const code = typeof payload.code === "string" ? payload.code.trim() : "";
    if (!code) {
      return NextResponse.json({ error: "Code parrain manquant." }, { status: 400 });
    }

    await bindReferralCodeByBackend({
      refereeId: session.customerId,
      referralCode: code,
    });

    const [summary, customer] = await Promise.all([
      getReferralSummaryByBackend(session.customerId),
      getCustomerByIdByBackend(session.customerId),
    ]);

    return NextResponse.json({ summary, user: customer });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Impossible d'appliquer ce code parrain." },
      { status: 400 },
    );
  }
}
