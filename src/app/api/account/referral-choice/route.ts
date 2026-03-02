import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import { chooseReferralRewardByBackend } from "@/lib/missions-backend";

export async function POST(request: Request) {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as {
      pendingRewardId?: string;
      choice?: string;
    };

    const pendingRewardId =
      typeof payload.pendingRewardId === "string" ? payload.pendingRewardId.trim() : "";
    const choice = payload.choice === "points" || payload.choice === "packs" ? payload.choice : "";

    if (!pendingRewardId || !choice) {
      return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    }

    await chooseReferralRewardByBackend({
      pendingRewardId,
      referrerId: session.customerId,
      choice,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erreur choix récompense parrainage.",
      },
      { status: 400 },
    );
  }
}
