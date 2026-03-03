import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { denyIfNotAdminApi, getValidatedAdminContext } from "@/lib/admin-guard";
import {
  createSocialMissionByBackend,
  getAdminMissionsOverviewByBackend,
  getAdminReferralPendingRewardsByBackend,
  getAdminSocialMissionsByBackend,
  getReferralRewardSettingsByBackend,
  reorderSocialMissionsByBackend,
  reviewMissionSubmissionByBackend,
  updateReferralRewardSettingsByBackend,
  updateSocialMissionByBackend,
} from "@/lib/missions-backend";
import type { SocialMissionEditorInput } from "@/types/missions";

function toMissionInput(value: unknown): SocialMissionEditorInput | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  return {
    slug: typeof raw.slug === "string" ? raw.slug : "",
    title: typeof raw.title === "string" ? raw.title : "",
    description: typeof raw.description === "string" ? raw.description : "",
    icon: (typeof raw.icon === "string" ? raw.icon : "star") as SocialMissionEditorInput["icon"],
    rewardType:
      (typeof raw.rewardType === "string"
        ? raw.rewardType
        : "packs") as SocialMissionEditorInput["rewardType"],
    rewardAmount: typeof raw.rewardAmount === "number" ? raw.rewardAmount : Number(raw.rewardAmount),
    maxCompletionsPerUser:
      typeof raw.maxCompletionsPerUser === "number"
        ? raw.maxCompletionsPerUser
        : Number(raw.maxCompletionsPerUser),
    requiresProof: raw.requiresProof === true,
    proofInstructions:
      typeof raw.proofInstructions === "string" ? raw.proofInstructions : null,
    isActive: raw.isActive !== false,
  };
}

function toReferralSettingsInput(
  value: unknown,
): { pointsAmount: number; packsAmount: number } | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  return {
    pointsAmount:
      typeof raw.pointsAmount === "number" ? raw.pointsAmount : Number(raw.pointsAmount),
    packsAmount: typeof raw.packsAmount === "number" ? raw.packsAmount : Number(raw.packsAmount),
  };
}

export async function GET() {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  try {
    const [overview, missions, pendingReferrals, referralSettings] = await Promise.all([
      getAdminMissionsOverviewByBackend(),
      getAdminSocialMissionsByBackend(),
      getAdminReferralPendingRewardsByBackend(),
      getReferralRewardSettingsByBackend(),
    ]);

    return NextResponse.json({
      overview,
      missions,
      pendingReferrals,
      referralSettings,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erreur chargement missions admin.",
      },
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
        { error: "Donnees invalides (submissionId + action requis)." },
        { status: 400 },
      );
    }

    await reviewMissionSubmissionByBackend({
      submissionId,
      action,
      adminEmail: context.email,
      adminNote: payload.adminNote,
    });

    logAuditEvent({
      eventType: "review_mission_submission",
      actorEmail: context.email,
      metadata: {
        submissionId,
        action,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erreur traitement soumission.",
      },
      { status: 400 },
    );
  }
}

export async function PUT(request: Request) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const context = await getValidatedAdminContext();
  if (!context) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as { mission?: unknown };
    const mission = toMissionInput(payload.mission);

    if (!mission) {
      return NextResponse.json({ error: "Mission invalide." }, { status: 400 });
    }

    const createdMission = await createSocialMissionByBackend(mission);

    logAuditEvent({
      eventType: "create_mission",
      actorEmail: context.email,
      metadata: {
        missionId: createdMission.id,
        slug: createdMission.slug,
      },
    });

    return NextResponse.json({ mission: createdMission }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erreur creation mission.",
      },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const context = await getValidatedAdminContext();
  if (!context) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as
      | {
          kind?: "mission";
          missionId?: string;
          mission?: unknown;
        }
      | {
          kind?: "reorder";
          missionIds?: unknown;
        }
      | {
          kind?: "referralSettings";
          referralSettings?: unknown;
        };

    if (payload.kind === "mission") {
      const missionId =
        typeof payload.missionId === "string" ? payload.missionId.trim() : "";
      const mission = toMissionInput(payload.mission);
      if (!missionId || !mission) {
        return NextResponse.json({ error: "Mission invalide." }, { status: 400 });
      }

      const updatedMission = await updateSocialMissionByBackend({
        missionId,
        mission,
      });

      logAuditEvent({
        eventType: "update_mission",
        actorEmail: context.email,
        metadata: {
          missionId: updatedMission.id,
          slug: updatedMission.slug,
          isActive: updatedMission.isActive,
        },
      });

      return NextResponse.json({ mission: updatedMission });
    }

    if (payload.kind === "reorder") {
      const missionIds = Array.isArray(payload.missionIds)
        ? payload.missionIds.filter((value): value is string => typeof value === "string")
        : [];

      if (missionIds.length === 0) {
        return NextResponse.json({ error: "Ordre des missions invalide." }, { status: 400 });
      }

      const missions = await reorderSocialMissionsByBackend(missionIds);

      logAuditEvent({
        eventType: "reorder_missions",
        actorEmail: context.email,
        metadata: {
          missionIds,
        },
      });

      return NextResponse.json({ missions });
    }

    if (payload.kind === "referralSettings") {
      const referralSettings = toReferralSettingsInput(payload.referralSettings);
      if (!referralSettings) {
        return NextResponse.json(
          { error: "Configuration de parrainage invalide." },
          { status: 400 },
        );
      }

      const updatedSettings = await updateReferralRewardSettingsByBackend(referralSettings);

      logAuditEvent({
        eventType: "update_referral_reward_settings",
        actorEmail: context.email,
        metadata: updatedSettings,
      });

      return NextResponse.json({ referralSettings: updatedSettings });
    }

    return NextResponse.json({ error: "Operation inconnue." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erreur mise a jour missions.",
      },
      { status: 400 },
    );
  }
}
