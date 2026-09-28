import { NextResponse } from "next/server";
import { isMissionUuid, isSameOriginMissionRequest, MissionRequestError } from "@/lib/mission-proof-policy";
import { hitRateLimit } from "@/lib/security-rate-limit";
import { logAuditEvent } from "@/lib/audit-log";
import { denyIfNotAdminApi, getValidatedAdminContext } from "@/lib/admin-guard";
import {
  createSocialMissionByBackend,
  getMissionBuddyOptionsByBackend,
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
    rewardCardId: typeof raw.rewardCardId === "string" ? raw.rewardCardId : null,
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
    const [overview, missions, pendingReferrals, referralSettings, buddyOptions] = await Promise.all([
      getAdminMissionsOverviewByBackend(),
      getAdminSocialMissionsByBackend(),
      getAdminReferralPendingRewardsByBackend(),
      getReferralRewardSettingsByBackend(),
      getMissionBuddyOptionsByBackend(),
    ]);

    return NextResponse.json({
      overview,
      missions,
      pendingReferrals,
      referralSettings,
      buddyOptions,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return missionErrorResponse(error);
  }
}

export async function POST(request: Request) {
  if (!isSameOriginMissionRequest(request)) return NextResponse.json({ error: "Origine invalide." }, { status: 403 });
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const context = await getValidatedAdminContext();
  if (!context) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  try {
    const rate = await hitRateLimit({ key: `admin_missions:${context.email}`, windowSeconds: 60, maxHits: 60 });
    if (!rate.allowed) return NextResponse.json({ error: "Trop de demandes. Réessaie dans un instant." }, { status: 429 });
    const payload = (await readAdminPayload(request)) as {
      submissionId?: string;
      action?: string;
      adminNote?: string;
      requestKey?: string;
      expectedRevision?: number;
    };

    const submissionId =
      typeof payload.submissionId === "string" ? payload.submissionId.trim() : "";
    const action =
      payload.action === "approve" || payload.action === "reject" || payload.action === "request_changes" ? payload.action : "";

    if (!isMissionUuid(submissionId) || !action || !isMissionUuid(payload.requestKey) || !Number.isSafeInteger(payload.expectedRevision) || (payload.expectedRevision ?? 0) < 1 || (payload.adminNote !== undefined && typeof payload.adminNote !== "string")) {
      return NextResponse.json(
        { error: "Donnees invalides (submissionId + action requis)." },
        { status: 400 },
      );
    }

    await reviewMissionSubmissionByBackend({
      submissionId,
      action,
      requestKey: payload.requestKey,
      expectedRevision: payload.expectedRevision!,
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
    return missionErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  if (!isSameOriginMissionRequest(request)) return NextResponse.json({ error: "Origine invalide." }, { status: 403 });
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const context = await getValidatedAdminContext();
  if (!context) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  try {
    const rate = await hitRateLimit({ key: `admin_missions:${context.email}`, windowSeconds: 60, maxHits: 60 });
    if (!rate.allowed) return NextResponse.json({ error: "Trop de demandes. Réessaie dans un instant." }, { status: 429 });
    const payload = (await readAdminPayload(request)) as { mission?: unknown };
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
    return missionErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  if (!isSameOriginMissionRequest(request)) return NextResponse.json({ error: "Origine invalide." }, { status: 403 });
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const context = await getValidatedAdminContext();
  if (!context) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  try {
    const rate = await hitRateLimit({ key: `admin_missions:${context.email}`, windowSeconds: 60, maxHits: 60 });
    if (!rate.allowed) return NextResponse.json({ error: "Trop de demandes. Réessaie dans un instant." }, { status: 429 });
    const payload = (await readAdminPayload(request)) as
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
    return missionErrorResponse(error);
  }
}

async function readAdminPayload(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > 32768) throw new MissionRequestError("Demande trop volumineuse.", 413);
  const body = await request.text();
  if (body.length > 32768) throw new MissionRequestError("Demande trop volumineuse.", 413);
  try { return JSON.parse(body); } catch { throw new MissionRequestError("Formulaire invalide."); }
}

function missionErrorResponse(error: unknown) {
  if (error instanceof MissionRequestError) return NextResponse.json({ error: error.message }, { status: error.status });
  return NextResponse.json({ error: "Impossible de traiter la demande pour le moment." }, { status: 503 });
}
