import { NextResponse } from "next/server";
import { denyIfNotAdminApi, getValidatedAdminContext } from "@/lib/admin-guard";
import {
  getAdminMissionsOverviewByBackend,
  getAdminReferralPendingRewardsByBackend,
  reviewMissionSubmissionByBackend,
} from "@/lib/missions-backend";

export async function GET() {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  try {
    const [overview, pendingReferrals] = await Promise.all([
      getAdminMissionsOverviewByBackend(),
      getAdminReferralPendingRewardsByBackend(),
    ]);

    return NextResponse.json({ overview, pendingReferrals });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur chargement missions admin." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const context = await getValidatedAdminContext();
  if (!context) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as {
      submissionId?: string;
      action?: string;
      adminNote?: string;
    };

    const submissionId =
      typeof payload.submissionId === "string" ? payload.submissionId.trim() : "";
    const action =
      payload.action === "approve" || payload.action === "reject" ? payload.action : "";

    if (!submissionId || !action) {
      return NextResponse.json(
        { error: "Données invalides (submissionId + action requis)." },
        { status: 400 },
      );
    }

    await reviewMissionSubmissionByBackend({
      submissionId,
      action,
      adminEmail: context.email,
      adminNote: payload.adminNote,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erreur traitement soumission.",
      },
      { status: 400 },
    );
  }
}
