import { NextResponse } from "next/server";
import { getCurrentCustomerSessionByBackend } from "@/lib/customer-backend";
import {
  getCustomerMissionsByBackend,
  getReferralPendingRewardsByBackend,
  submitMissionProofByBackend,
} from "@/lib/missions-backend";

export async function GET() {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  try {
    const [missions, pendingRewards] = await Promise.all([
      getCustomerMissionsByBackend(session.customerId),
      getReferralPendingRewardsByBackend(session.customerId),
    ]);

    return NextResponse.json({ missions, pendingRewards });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur chargement missions." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await getCurrentCustomerSessionByBackend();
  if (!session) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as {
      missionId?: string;
      proofUrl?: string;
      proofText?: string;
    };

    const missionId = typeof payload.missionId === "string" ? payload.missionId.trim() : "";
    if (!missionId) {
      return NextResponse.json({ error: "Mission manquante." }, { status: 400 });
    }

    const submission = await submitMissionProofByBackend({
      userId: session.customerId,
      missionId,
      proofUrl: payload.proofUrl,
      proofText: payload.proofText,
    });

    return NextResponse.json({ submission });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur soumission mission." },
      { status: 400 },
    );
  }
}
