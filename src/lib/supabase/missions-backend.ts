import "server-only";

import { createMissionProofSignedUrl, deleteMissionProof } from "@/lib/mission-proof-storage";
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
  ReferralRewardSettings,
  ReferralPendingReward,
  SocialMission,
  SocialMissionEditorInput,
} from "@/types/missions";

const SELECT_SOCIAL_MISSIONS_COLUMNS = [
  "id",
  "slug",
  "title",
  "description",
  "icon",
  "reward_type",
  "reward_amount",
  "max_completions_per_user",
  "requires_proof",
  "proof_instructions",
  "is_active",
  "sort_order",
].join(",");

const SELECT_MISSION_SUBMISSIONS_COLUMNS = [
  "id",
  "user_id",
  "mission_id",
  "proof_url",
  "proof_storage_path",
  "proof_content_type",
  "proof_file_size",
  "proof_uploaded_at",
  "proof_text",
  "status",
  "admin_note",
  "reviewed_by",
  "reviewed_at",
  "reward_granted",
  "created_at",
].join(",");

const SELECT_REFERRAL_PENDING_COLUMNS = [
  "id",
  "referrer_id",
  "referee_id",
  "order_id",
  "status",
  "points_amount",
  "packs_amount",
  "chosen_at",
  "created_at",
].join(",");

const SELECT_REFERRAL_REWARD_SETTINGS_COLUMNS = [
  "id",
  "points_amount",
  "packs_amount",
  "updated_at",
].join(",");

const DEFAULT_REFERRAL_REWARD_SETTINGS = {
  pointsAmount: 50,
  packsAmount: 5,
} as const;

const MISSION_ICON_VALUES = new Set<MissionIcon>([
  "instagram",
  "facebook",
  "tiktok",
  "camera",
  "star",
]);

const MISSION_REWARD_TYPE_VALUES = new Set<MissionRewardType>(["packs", "points"]);

// ── Helpers ──

function failIfError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`[supabase:${context}] ${error.message}`);
  }
}

function isMissingReferralRewardSettingsTable(error: { message: string } | null): boolean {
  const message = error?.message ?? "";
  return (
    message.includes("referral_reward_settings") &&
    (message.includes("does not exist") ||
      message.includes("Could not find the table") ||
      message.includes("relation"))
  );
}

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function toNullableInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return null;
  }

  return Math.max(0, Math.round(n));
}

function toBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeSlug(value: unknown): string {
  const raw = toText(value).trim().toLowerCase();
  if (!raw) {
    return "";
  }

  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toMissionIcon(value: unknown): MissionIcon {
  const icon = toText(value) as MissionIcon;
  return MISSION_ICON_VALUES.has(icon) ? icon : "star";
}

function toMissionRewardType(value: unknown): MissionRewardType {
  const rewardType = toText(value) as MissionRewardType;
  return MISSION_REWARD_TYPE_VALUES.has(rewardType) ? rewardType : "packs";
}

function normalizeMissionEditorInput(input: SocialMissionEditorInput): SocialMissionEditorInput {
  const slug = normalizeSlug(input.slug);
  const title = toText(input.title).trim();
  const description = toText(input.description).trim();
  const rewardAmount = Math.max(1, toInt(input.rewardAmount, 1));
  const maxCompletionsPerUser = Math.max(1, toInt(input.maxCompletionsPerUser, 1));
  const requiresProof = toBoolean(input.requiresProof, true);
  const proofInstructions = toText(input.proofInstructions).trim();

  if (!slug) {
    throw new Error("Le slug de mission est requis.");
  }

  if (!title) {
    throw new Error("Le titre de mission est requis.");
  }

  if (!description) {
    throw new Error("La description de mission est requise.");
  }

  if (requiresProof && !proofInstructions) {
    throw new Error("Les instructions de preuve sont requises.");
  }

  return {
    slug,
    title,
    description,
    icon: toMissionIcon(input.icon),
    rewardType: toMissionRewardType(input.rewardType),
    rewardAmount,
    maxCompletionsPerUser,
    requiresProof,
    proofInstructions: requiresProof ? proofInstructions : null,
    isActive: toBoolean(input.isActive, true),
  };
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
    proofStoragePath:
      typeof row.proof_storage_path === "string" ? row.proof_storage_path : null,
    proofContentType:
      typeof row.proof_content_type === "string" ? row.proof_content_type : null,
    proofFileSize: toNullableInt(row.proof_file_size),
    proofUploadedAt:
      typeof row.proof_uploaded_at === "string" ? row.proof_uploaded_at : null,
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

function rowToReferralRewardSettings(row: Record<string, unknown>): ReferralRewardSettings {
  return {
    pointsAmount: toInt(row.points_amount, DEFAULT_REFERRAL_REWARD_SETTINGS.pointsAmount),
    packsAmount: toInt(row.packs_amount, DEFAULT_REFERRAL_REWARD_SETTINGS.packsAmount),
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
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
      .select(SELECT_SOCIAL_MISSIONS_COLUMNS)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("social_mission_submissions")
      .select(SELECT_MISSION_SUBMISSIONS_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  failIfError(missionsResult.error, "list social_missions");
  failIfError(submissionsResult.error, "list user submissions");

  const missions = (missionsResult.data ?? []).map((row) =>
    rowToMission(row as unknown as Record<string, unknown>),
  );
  const submissions = (submissionsResult.data ?? []).map((row) =>
    rowToSubmission(row as unknown as Record<string, unknown>),
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
  proofStoragePath?: string;
  proofContentType?: string;
  proofFileSize?: number;
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
    .select("id,max_completions_per_user,requires_proof")
    .eq("id", missionId)
    .eq("is_active", true)
    .maybeSingle();
  failIfError(missionResult.error, "check mission");

  if (!missionResult.data) {
    throw new Error("Mission introuvable ou inactive.");
  }

  const missionRow = missionResult.data as Record<string, unknown>;
  const maxCompletions = toInt(missionRow.max_completions_per_user, 1);
  const requiresProof = missionRow.requires_proof === true;

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

  if (requiresProof && !input.proofStoragePath?.trim()) {
    throw new Error("Une capture d'ecran est requise pour cette mission.");
  }

  const insertResult = await supabase
    .from("social_mission_submissions")
    .insert({
      user_id: userId,
      mission_id: missionId,
      proof_url: input.proofUrl?.trim() || null,
      proof_storage_path: input.proofStoragePath?.trim() || null,
      proof_content_type: input.proofContentType?.trim() || null,
      proof_file_size:
        typeof input.proofFileSize === "number" && Number.isFinite(input.proofFileSize)
          ? Math.max(0, Math.floor(input.proofFileSize))
          : null,
      proof_uploaded_at: input.proofStoragePath?.trim() ? new Date().toISOString() : null,
      proof_text: input.proofText?.trim() || null,
      status: "pending",
    })
    .select(SELECT_MISSION_SUBMISSIONS_COLUMNS)
    .single();
  failIfError(insertResult.error, "insert mission submission");

  return rowToSubmission(insertResult.data as unknown as Record<string, unknown>);
}

// ── Admin: overview of all submissions ──

export async function getAdminMissionsOverviewFromSupabase(): Promise<AdminMissionsOverview> {
  const supabase = createSupabaseServiceClient();

  const [missionsResult, submissionsResult, usersResult] = await Promise.all([
    supabase
      .from("social_missions")
      .select(SELECT_SOCIAL_MISSIONS_COLUMNS)
      .order("sort_order", { ascending: true }),
    supabase
      .from("social_mission_submissions")
      .select(SELECT_MISSION_SUBMISSIONS_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.auth.admin.listUsers(),
  ]);

  failIfError(missionsResult.error, "admin list missions");
  failIfError(submissionsResult.error, "admin list submissions");
  failIfError(usersResult.error, "auth.admin.listUsers for missions");

  const missions = (missionsResult.data ?? []).map((row) =>
    rowToMission(row as unknown as Record<string, unknown>),
  );
  const missionsById = new Map(missions.map((m) => [m.id, m]));

  const rawSubmissions = (submissionsResult.data ?? []).map((row) =>
    rowToSubmission(row as unknown as Record<string, unknown>),
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

  const signedUrlEntries = await Promise.all(
    rawSubmissions.map(async (submission) => {
      if (!submission.proofStoragePath) {
        return [submission.id, null] as const;
      }

      return [submission.id, await createMissionProofSignedUrl(submission.proofStoragePath)] as const;
    }),
  );
  const signedUrlById = new Map(signedUrlEntries);

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
      proofSignedUrl: signedUrlById.get(sub.id) ?? null,
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

export async function getAdminSocialMissionsFromSupabase(): Promise<SocialMission[]> {
  const supabase = createSupabaseServiceClient();

  const result = await supabase
    .from("social_missions")
    .select(SELECT_SOCIAL_MISSIONS_COLUMNS)
    .order("sort_order", { ascending: true });
  failIfError(result.error, "admin list social_missions");

  return (result.data ?? []).map((row) =>
    rowToMission(row as unknown as Record<string, unknown>),
  );
}

export async function createSocialMissionInSupabase(
  input: SocialMissionEditorInput,
): Promise<SocialMission> {
  const supabase = createSupabaseServiceClient();
  const mission = normalizeMissionEditorInput(input);

  const lastMissionResult = await supabase
    .from("social_missions")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  failIfError(lastMissionResult.error, "get last social_mission sort_order");

  const nextSortOrder = toInt(lastMissionResult.data?.sort_order, 0) + 10;
  const now = new Date().toISOString();

  const result = await supabase
    .from("social_missions")
    .insert({
      slug: mission.slug,
      title: mission.title,
      description: mission.description,
      icon: mission.icon,
      reward_type: mission.rewardType,
      reward_amount: mission.rewardAmount,
      max_completions_per_user: mission.maxCompletionsPerUser,
      requires_proof: mission.requiresProof,
      proof_instructions: mission.proofInstructions,
      is_active: mission.isActive,
      sort_order: nextSortOrder,
      updated_at: now,
    })
    .select(SELECT_SOCIAL_MISSIONS_COLUMNS)
    .maybeSingle();

  if (result.error?.message.includes("social_missions_slug_key")) {
    throw new Error("Une mission avec ce slug existe deja.");
  }
  failIfError(result.error, "create social_mission");

  if (!result.data) {
    throw new Error("La mission n'a pas pu etre creee.");
  }

  return rowToMission(result.data as unknown as Record<string, unknown>);
}

export async function updateSocialMissionInSupabase(input: {
  missionId: string;
  mission: SocialMissionEditorInput;
}): Promise<SocialMission> {
  const missionId = input.missionId.trim();
  if (!missionId) {
    throw new Error("Mission invalide.");
  }

  const supabase = createSupabaseServiceClient();
  const mission = normalizeMissionEditorInput(input.mission);

  const result = await supabase
    .from("social_missions")
    .update({
      slug: mission.slug,
      title: mission.title,
      description: mission.description,
      icon: mission.icon,
      reward_type: mission.rewardType,
      reward_amount: mission.rewardAmount,
      max_completions_per_user: mission.maxCompletionsPerUser,
      requires_proof: mission.requiresProof,
      proof_instructions: mission.proofInstructions,
      is_active: mission.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", missionId)
    .select(SELECT_SOCIAL_MISSIONS_COLUMNS)
    .maybeSingle();

  if (result.error?.message.includes("social_missions_slug_key")) {
    throw new Error("Une mission avec ce slug existe deja.");
  }
  failIfError(result.error, "update social_mission");

  if (!result.data) {
    throw new Error("Mission introuvable.");
  }

  return rowToMission(result.data as unknown as Record<string, unknown>);
}

export async function reorderSocialMissionsInSupabase(
  missionIds: string[],
): Promise<SocialMission[]> {
  const cleanedIds = missionIds.map((id) => id.trim()).filter(Boolean);
  if (cleanedIds.length === 0) {
    throw new Error("Ordre des missions invalide.");
  }

  const supabase = createSupabaseServiceClient();
  const now = new Date().toISOString();

  const results = await Promise.all(
    cleanedIds.map((missionId, index) =>
      supabase
        .from("social_missions")
        .update({
          sort_order: (index + 1) * 10,
          updated_at: now,
        })
        .eq("id", missionId),
    ),
  );

  for (const result of results) {
    failIfError(result.error, "reorder social_missions");
  }

  return getAdminSocialMissionsFromSupabase();
}

export async function getReferralRewardSettingsFromSupabase(): Promise<ReferralRewardSettings> {
  const supabase = createSupabaseServiceClient();

  const result = await supabase
    .from("referral_reward_settings")
    .select(SELECT_REFERRAL_REWARD_SETTINGS_COLUMNS)
    .eq("id", "default")
    .maybeSingle();
  if (isMissingReferralRewardSettingsTable(result.error)) {
    return {
      ...DEFAULT_REFERRAL_REWARD_SETTINGS,
      updatedAt: null,
    };
  }
  failIfError(result.error, "get referral_reward_settings");

  if (result.data) {
    return rowToReferralRewardSettings(result.data as unknown as Record<string, unknown>);
  }

  const insertResult = await supabase
    .from("referral_reward_settings")
    .upsert({
      id: "default",
      points_amount: DEFAULT_REFERRAL_REWARD_SETTINGS.pointsAmount,
      packs_amount: DEFAULT_REFERRAL_REWARD_SETTINGS.packsAmount,
      updated_at: new Date().toISOString(),
    })
    .select(SELECT_REFERRAL_REWARD_SETTINGS_COLUMNS)
    .maybeSingle();
  failIfError(insertResult.error, "create default referral_reward_settings");

  if (!insertResult.data) {
    return {
      ...DEFAULT_REFERRAL_REWARD_SETTINGS,
      updatedAt: null,
    };
  }

  return rowToReferralRewardSettings(insertResult.data as unknown as Record<string, unknown>);
}

export async function updateReferralRewardSettingsInSupabase(input: {
  pointsAmount: number;
  packsAmount: number;
}): Promise<ReferralRewardSettings> {
  const pointsAmount = Math.max(
    1,
    toInt(input.pointsAmount, DEFAULT_REFERRAL_REWARD_SETTINGS.pointsAmount),
  );
  const packsAmount = Math.max(
    1,
    toInt(input.packsAmount, DEFAULT_REFERRAL_REWARD_SETTINGS.packsAmount),
  );

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("referral_reward_settings")
    .upsert({
      id: "default",
      points_amount: pointsAmount,
      packs_amount: packsAmount,
      updated_at: new Date().toISOString(),
    })
    .select(SELECT_REFERRAL_REWARD_SETTINGS_COLUMNS)
    .maybeSingle();
  if (isMissingReferralRewardSettingsTable(result.error)) {
    throw new Error(
      "La table referral_reward_settings est absente. Applique d'abord la migration Supabase recente.",
    );
  }
  failIfError(result.error, "update referral_reward_settings");

  if (!result.data) {
    throw new Error("La configuration de parrainage n'a pas pu etre enregistree.");
  }

  return rowToReferralRewardSettings(result.data as unknown as Record<string, unknown>);
}

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
    .select(SELECT_MISSION_SUBMISSIONS_COLUMNS)
    .eq("id", submissionId)
    .maybeSingle();
  failIfError(subResult.error, "fetch submission for review");

  if (!subResult.data) {
    throw new Error("Soumission introuvable.");
  }

  const submission = rowToSubmission(subResult.data as unknown as Record<string, unknown>);

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
          reason: `Mission: ${submission.missionId}`,
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

  if (submission.proofStoragePath) {
    try {
      await deleteMissionProof(submission.proofStoragePath);

      const cleanupResult = await supabase
        .from("social_mission_submissions")
        .update({
          proof_url: null,
          proof_storage_path: null,
          proof_content_type: null,
          proof_file_size: null,
          proof_uploaded_at: null,
        })
        .eq("id", submissionId);
      failIfError(cleanupResult.error, "cleanup mission proof metadata");
    } catch (error) {
      console.error("[missions] proof cleanup failed", {
        submissionId,
        proofStoragePath: submission.proofStoragePath,
        error,
      });
    }
  }
}

// ── Referral Pending Rewards ──

export async function createReferralPendingRewardInSupabase(input: {
  referrerId: string;
  refereeId: string;
  orderId: string;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const settings = await getReferralRewardSettingsFromSupabase();

  const result = await supabase
    .from("referral_pending_rewards")
    .insert({
      referrer_id: input.referrerId,
      referee_id: input.refereeId,
      order_id: input.orderId,
      status: "pending",
      points_amount: settings.pointsAmount,
      packs_amount: settings.packsAmount,
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
    .select(SELECT_REFERRAL_PENDING_COLUMNS)
    .eq("referrer_id", referrerId)
    .order("created_at", { ascending: false });
  failIfError(result.error, "list referral_pending_rewards");

  return (result.data ?? []).map((row) =>
    rowToReferralPending(row as unknown as Record<string, unknown>),
  );
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
    .select(SELECT_REFERRAL_PENDING_COLUMNS)
    .eq("id", input.pendingRewardId)
    .eq("referrer_id", input.referrerId)
    .eq("status", "pending")
    .maybeSingle();
  failIfError(pendingResult.error, "fetch referral_pending_reward");

  if (!pendingResult.data) {
    throw new Error("Récompense introuvable ou déjà choisie.");
  }

  const pending = rowToReferralPending(pendingResult.data as unknown as Record<string, unknown>);

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
    .select(SELECT_REFERRAL_PENDING_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);
  failIfError(result.error, "admin list referral_pending_rewards");

  return (result.data ?? []).map((row) =>
    rowToReferralPending(row as unknown as Record<string, unknown>),
  );
}
