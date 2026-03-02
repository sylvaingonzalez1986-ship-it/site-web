import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { grantLotteryTicketsToCustomerInSupabase } from "@/lib/supabase/lottery-backend";
import type {
  AdminMissionsOverview,
  AdminMissionSubmissionView,
  MissionIcon,
  MissionRewardType,
  MissionSubmission,
  MissionSubmissionStatus,
  MissionWithUserStatus,
  ReferralPendingReward,
  SocialMission,
} from "@/types/missions";

// ── Helpers ──

function failIfError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`[supabase:${context}] ${error.message}`);
  }
}

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

// ── Row → domain mappers ──

function rowToMission(row: Record<string, unknown>): SocialMission {
  return {
    id: toText(row.id),
    slug: toText(row.slug),
    title: toText(row.title),
    description: toText(row.description),
    icon: (toText(row.icon) || "star") as MissionIcon,
    rewardType: (toText(row.reward_type) || "packs") as MissionRewardType,
    rewardAmount: toInt(row.reward_amount, 1),
    maxCompletionsPerUser: toInt(row.max_completions_per_user, 1),
    requiresProof: row.requires_proof === true,
    proofInstructions: typeof row.proof_instructions === "string" ? row.proof_instructions : null,
    isActive: row.is_active !== false,
    sortOrder: toInt(row.sort_order, 0),
  };
}

function rowToSubmission(row: Record<string, unknown>): MissionSubmission {
  return {
    id: toText(row.id),
    userId: toText(row.user_id),
    missionId: toText(row.mission_id),
    proofUrl: typeof row.proof_url === "string" ? row.proof_url : null,
    proofText: typeof row.proof_text === "string" ? row.proof_text : null,
    status: (toText(row.status) || "pending") as MissionSubmissionStatus,
    adminNote: typeof row.admin_note === "string" ? row.admin_note : null,
    reviewedBy: typeof row.reviewed_by === "string" ? row.reviewed_by : null,
    reviewedAt: typeof row.reviewed_at === "string" ? row.reviewed_at : null,
    rewardGranted: row.reward_granted === true,
    createdAt: toText(row.created_at) || new Date().toISOString(),
  };
}

function rowToReferralPending(row: Record<string, unknown>): ReferralPendingReward {
  return {
    id: toText(row.id),
    referrerId: toText(row.referrer_id),
    refereeId: toText(row.referee_id),
    orderId: toText(row.order_id),
    status: (toText(row.status) || "pending") as ReferralPendingReward["status"],
    pointsAmount: toInt(row.points_amount, 50),
    packsAmount: toInt(row.packs_amount, 5),
    chosenAt: typeof row.chosen_at === "string" ? row.chosen_at : null,
    createdAt: toText(row.created_at) || new Date().toISOString(),
  };
}

// ── Customer-facing: list missions with user progress ──

export async function getCustomerMissionsFromSupabase(
  userId: string,
): Promise<MissionWithUserStatus[]> {
  const supabase = createSupabaseServiceClient();

  const [missionsResult, submissionsResult] = await Promise.all([
    supabase
      .from("social_missions")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("social_mission_submissions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  failIfError(missionsResult.error, "list social_missions");
  failIfError(submissionsResult.error, "list user submissions");

  const missions = ((missionsResult.data ?? []) as Record<string, unknown>[]).map(rowToMission);
  const submissions = ((submissionsResult.data ?? []) as Record<string, unknown>[]).map(
    rowToSubmission,
  );

  return missions.map((mission) => {
    const userSubmissions = submissions.filter((s) => s.missionId === mission.id);
    const approvedCount = userSubmissions.filter((s) => s.status === "approved").length;
    const pendingCount = userSubmissions.filter((s) => s.status === "pending").length;
    const canSubmit =
      approvedCount < mission.maxCompletionsPerUser && pendingCount === 0;

    return {
      ...mission,
      userSubmissions,
      completedCount: approvedCount,
      canSubmit,
    };
  });
}

// ── Customer: submit a mission for review ──

export async function submitMissionProofInSupabase(input: {
  userId: string;
  missionId: string;
  proofUrl?: string;
  proofText?: string;
}): Promise<MissionSubmission> {
  const userId = input.userId.trim();
  const missionId = input.missionId.trim();
  if (!userId || !missionId) {
    throw new Error("Données invalides.");
  }

  const supabase = createSupabaseServiceClient();

  // Verify mission exists and is active
  const missionResult = await supabase
    .from("social_missions")
    .select("id,max_completions_per_user")
    .eq("id", missionId)
    .eq("is_active", true)
    .maybeSingle();
  failIfError(missionResult.error, "check mission");

  if (!missionResult.data) {
    throw new Error("Mission introuvable ou inactive.");
  }

  const maxCompletions = toInt(
    (missionResult.data as Record<string, unknown>).max_completions_per_user,
    1,
  );

  // Check user hasn't exceeded max completions or has pending
  const existingResult = await supabase
    .from("social_mission_submissions")
    .select("id,status")
    .eq("user_id", userId)
    .eq("mission_id", missionId);
  failIfError(existingResult.error, "check existing submissions");

  const existing = (existingResult.data ?? []) as { id: string; status: string }[];
  const approvedCount = existing.filter((s) => s.status === "approved").length;
  const pendingCount = existing.filter((s) => s.status === "pending").length;

  if (approvedCount >= maxCompletions) {
    throw new Error("Tu as déjà complété cette mission.");
  }

  if (pendingCount > 0) {
    throw new Error("Tu as déjà une soumission en attente de validation pour cette mission.");
  }

  const insertResult = await supabase
    .from("social_mission_submissions")
    .insert({
      user_id: userId,
      mission_id: missionId,
      proof_url: input.proofUrl?.trim() || null,
      proof_text: input.proofText?.trim() || null,
      status: "pending",
    })
    .select("*")
    .single();
  failIfError(insertResult.error, "insert mission submission");

  return rowToSubmission(insertResult.data as Record<string, unknown>);
}

// ── Admin: overview of all submissions ──

export async function getAdminMissionsOverviewFromSupabase(): Promise<AdminMissionsOverview> {
  const supabase = createSupabaseServiceClient();

  const [missionsResult, submissionsResult, usersResult] = await Promise.all([
    supabase
      .from("social_missions")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase
      .from("social_mission_submissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.auth.admin.listUsers(),
  ]);

  failIfError(missionsResult.error, "admin list missions");
  failIfError(submissionsResult.error, "admin list submissions");
  failIfError(usersResult.error, "auth.admin.listUsers for missions");

  const missions = ((missionsResult.data ?? []) as Record<string, unknown>[]).map(rowToMission);
  const missionsById = new Map(missions.map((m) => [m.id, m]));

  const rawSubmissions = ((submissionsResult.data ?? []) as Record<string, unknown>[]).map(
    rowToSubmission,
  );

  // Fetch profile names for unique user IDs
  const userIds = [...new Set(rawSubmissions.map((s) => s.userId))];
  const profileNameById = new Map<string, { firstName: string; lastName: string }>();

  if (userIds.length > 0) {
    const profilesResult = await supabase
      .from("profiles")
      .select("id,first_name,last_name")
      .in("id", userIds);
    failIfError(profilesResult.error, "profiles for mission submissions");

    for (const row of (profilesResult.data ?? []) as { id: string; first_name: string | null; last_name: string | null }[]) {
      profileNameById.set(row.id, {
        firstName: row.first_name?.trim() || "",
        lastName: row.last_name?.trim() || "",
      });
    }
  }

  const emailById = new Map<string, string>();
  for (const user of usersResult.data.users ?? []) {
    if (user.id) {
      emailById.set(user.id, user.email ?? "");
    }
  }

  const submissions: AdminMissionSubmissionView[] = rawSubmissions.map((sub) => {
    const mission = missionsById.get(sub.missionId);
    const profile = profileNameById.get(sub.userId);
    const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "Client";

    return {
      ...sub,
      userEmail: emailById.get(sub.userId) ?? "",
      userName: fullName,
      missionTitle: mission?.title ?? "Mission inconnue",
      missionSlug: mission?.slug ?? "",
    };
  });

  return {
    totalMissions: missions.length,
    totalSubmissions: rawSubmissions.length,
    pendingSubmissions: rawSubmissions.filter((s) => s.status === "pending").length,
    approvedSubmissions: rawSubmissions.filter((s) => s.status === "approved").length,
    rejectedSubmissions: rawSubmissions.filter((s) => s.status === "rejected").length,
    submissions,
  };
}

// ── Admin: approve or reject a submission ──

export async function reviewMissionSubmissionInSupabase(input: {
  submissionId: string;
  action: "approve" | "reject";
  adminEmail: string;
  adminNote?: string;
}): Promise<void> {
  const submissionId = input.submissionId.trim();
  if (!submissionId) {
    throw new Error("Soumission invalide.");
  }

  const supabase = createSupabaseServiceClient();

  // Fetch submission
  const subResult = await supabase
    .from("social_mission_submissions")
    .select("*")
    .eq("id", submissionId)
    .maybeSingle();
  failIfError(subResult.error, "fetch submission for review");

  if (!subResult.data) {
    throw new Error("Soumission introuvable.");
  }

  const submission = rowToSubmission(subResult.data as Record<string, unknown>);

  if (submission.status !== "pending") {
    throw new Error("Cette soumission a déjà été traitée.");
  }

  const nextStatus: MissionSubmissionStatus =
    input.action === "approve" ? "approved" : "rejected";

  // If approving, grant the reward
  let rewardGranted = false;
  if (input.action === "approve") {
    // Fetch mission to know reward
    const missionResult = await supabase
      .from("social_missions")
      .select("reward_type,reward_amount")
      .eq("id", submission.missionId)
      .maybeSingle();
    failIfError(missionResult.error, "fetch mission for reward");

    if (missionResult.data) {
      const mission = missionResult.data as { reward_type: string; reward_amount: number };

      if (mission.reward_type === "packs") {
        await grantLotteryTicketsToCustomerInSupabase({
          userId: submission.userId,
          ticketCount: mission.reward_amount,
          reason: `Mission sociale: ${submission.missionId}`,
          adminEmail: input.adminEmail,
        });
        rewardGranted = true;
      } else if (mission.reward_type === "points") {
        // Grant loyalty points: read current then update
        const profileResult = await supabase
          .from("profiles")
          .select("loyalty_points")
          .eq("id", submission.userId)
          .maybeSingle();
        if (profileResult.data) {
          const currentPoints = toInt(
            (profileResult.data as Record<string, unknown>).loyalty_points,
            0,
          );
          const updateResult = await supabase
            .from("profiles")
            .update({ loyalty_points: currentPoints + mission.reward_amount })
            .eq("id", submission.userId);
          failIfError(updateResult.error, "grant mission points");
        }
        rewardGranted = true;
      }
    }
  }

  // Update submission status
  const updateResult = await supabase
    .from("social_mission_submissions")
    .update({
      status: nextStatus,
      admin_note: input.adminNote?.trim() || null,
      reviewed_by: input.adminEmail,
      reviewed_at: new Date().toISOString(),
      reward_granted: rewardGranted,
    })
    .eq("id", submissionId);
  failIfError(updateResult.error, "update mission submission status");
}

// ── Referral Pending Rewards ──

export async function createReferralPendingRewardInSupabase(input: {
  referrerId: string;
  refereeId: string;
  orderId: string;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();

  const result = await supabase
    .from("referral_pending_rewards")
    .insert({
      referrer_id: input.referrerId,
      referee_id: input.refereeId,
      order_id: input.orderId,
      status: "pending",
      points_amount: 50,
      packs_amount: 5,
    })
    .select("id")
    .maybeSingle();

  // Ignore duplicate (same referee + order)
  if (result.error && result.error.message.includes("duplicate")) {
    return;
  }
  failIfError(result.error, "insert referral_pending_rewards");
}

export async function getReferralPendingRewardsFromSupabase(
  referrerId: string,
): Promise<ReferralPendingReward[]> {
  const supabase = createSupabaseServiceClient();

  const result = await supabase
    .from("referral_pending_rewards")
    .select("*")
    .eq("referrer_id", referrerId)
    .order("created_at", { ascending: false });
  failIfError(result.error, "list referral_pending_rewards");

  return ((result.data ?? []) as Record<string, unknown>[]).map(rowToReferralPending);
}

export async function chooseReferralRewardInSupabase(input: {
  pendingRewardId: string;
  referrerId: string;
  choice: "points" | "packs";
}): Promise<void> {
  const supabase = createSupabaseServiceClient();

  // Fetch the pending reward
  const pendingResult = await supabase
    .from("referral_pending_rewards")
    .select("*")
    .eq("id", input.pendingRewardId)
    .eq("referrer_id", input.referrerId)
    .eq("status", "pending")
    .maybeSingle();
  failIfError(pendingResult.error, "fetch referral_pending_reward");

  if (!pendingResult.data) {
    throw new Error("Récompense introuvable ou déjà choisie.");
  }

  const pending = rowToReferralPending(pendingResult.data as Record<string, unknown>);

  if (input.choice === "points") {
    // Grant loyalty points
    const profileResult = await supabase
      .from("profiles")
      .select("loyalty_points")
      .eq("id", pending.referrerId)
      .maybeSingle();
    failIfError(profileResult.error, "fetch profile for referral points");

    if (profileResult.data) {
      const currentPoints = toInt(
        (profileResult.data as Record<string, unknown>).loyalty_points,
        0,
      );
      const updateResult = await supabase
        .from("profiles")
        .update({ loyalty_points: currentPoints + pending.pointsAmount })
        .eq("id", pending.referrerId);
      failIfError(updateResult.error, "grant referral points");
    }
  } else {
    // Grant packs
    await grantLotteryTicketsToCustomerInSupabase({
      userId: pending.referrerId,
      ticketCount: pending.packsAmount,
      reason: `Parrainage: choix packs (filleul commande ${pending.orderId})`,
      adminEmail: "system",
    });
  }

  // Update status
  const nextStatus = input.choice === "points" ? "chosen_points" : "chosen_packs";
  const updateResult = await supabase
    .from("referral_pending_rewards")
    .update({
      status: nextStatus,
      chosen_at: new Date().toISOString(),
    })
    .eq("id", input.pendingRewardId);
  failIfError(updateResult.error, "update referral_pending_reward status");
}

// ── Admin: list all referral pending rewards ──

export async function getAdminReferralPendingRewardsFromSupabase(): Promise<ReferralPendingReward[]> {
  const supabase = createSupabaseServiceClient();

  const result = await supabase
    .from("referral_pending_rewards")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  failIfError(result.error, "admin list referral_pending_rewards");

  return ((result.data ?? []) as Record<string, unknown>[]).map(rowToReferralPending);
}
