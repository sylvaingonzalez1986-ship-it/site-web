import "server-only";

import { createMissionProofSignedUrl } from "@/lib/mission-proof-storage";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { MissionRequestError, isMissionUuid, normalizeMissionProofUrl, MISSION_PROOF_TEXT_MAX_LENGTH } from "@/lib/mission-proof-policy";
import { MISSION_REWARD_LIMITS } from "@/lib/community-missions";
import { grantLotteryTicketsToCustomerInSupabase } from "@/lib/supabase/lottery-backend";
import type {
  AdminMissionsOverview,
  MissionBuddyOption,
  MissionProofSubmissionInput,
  MissionReviewInput,
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
  "reward_card_id",
  "reward_card:lottery_card_definitions!social_missions_reward_card_id_fkey(name)",
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
  "revision",
  "review_version",
  "reward_type_snapshot",
  "reward_amount_snapshot",
  "reward_card_id_snapshot",
  "reward_card_name_snapshot",
  "reward_label_snapshot",
  "mission_title_snapshot",
  "mission_slug_snapshot",
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

const MISSION_REWARD_TYPE_VALUES = new Set<MissionRewardType>(["packs", "points", "support_pack", "buddies", "game_cash"]);

// ── Helpers ──

function failIfError(error: { message: string } | null, context: string): void {
  if (error) {
    console.error("[missions] database operation failed", { context });
    throw new MissionRequestError("Le service missions est indisponible. Réessaie plus tard.", 503);
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
  if (value == null) return null;
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
  const rewardType = input.rewardType;
  const rewardAmount = input.rewardAmount;
  const maxCompletionsPerUser = input.maxCompletionsPerUser;
  if (!MISSION_REWARD_TYPE_VALUES.has(rewardType) || !Number.isSafeInteger(rewardAmount) || rewardAmount < 1 || rewardAmount > MISSION_REWARD_LIMITS[rewardType]) throw new MissionRequestError("Récompense invalide ou supérieure au plafond autorisé.");
  if (!Number.isSafeInteger(maxCompletionsPerUser) || maxCompletionsPerUser < 1 || maxCompletionsPerUser > 20) throw new MissionRequestError("Choisis entre 1 et 20 participations par joueur.");
  const rewardCardId = rewardType === "buddies" ? toText(input.rewardCardId).trim() : null;
  if (rewardType === "buddies" && !isMissionUuid(rewardCardId)) throw new MissionRequestError("Choisis un Buddy disponible.");
  const requiresProof = toBoolean(input.requiresProof, true);
  const proofInstructions = toText(input.proofInstructions).trim();

  if (slug.length > 120 || title.length > 160 || description.length > 4000 || proofInstructions.length > 2000) throw new MissionRequestError("Le contenu de la mission est trop long.");

  if (!slug) {
    throw new MissionRequestError("Le slug de mission est requis.");
  }

  if (!title) {
    throw new MissionRequestError("Le titre de mission est requis.");
  }

  if (!description) {
    throw new MissionRequestError("La description de mission est requise.");
  }

  if (requiresProof && !proofInstructions) {
    throw new MissionRequestError("Les instructions de preuve sont requises.");
  }

  return {
    slug,
    title,
    description,
    icon: toMissionIcon(input.icon),
    rewardType,
    rewardCardId,
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
    rewardCardId: typeof row.reward_card_id === "string" ? row.reward_card_id : null,
    rewardCardName: row.reward_card && typeof row.reward_card === "object" && "name" in row.reward_card ? toText(row.reward_card.name) : null,
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
    revision: toInt(row.revision, 1),
    rewardType: toMissionRewardType(row.reward_type_snapshot),
    rewardAmount: toInt(row.reward_amount_snapshot, 1),
    rewardCardId: typeof row.reward_card_id_snapshot === "string" ? row.reward_card_id_snapshot : null,
    rewardCardName: typeof row.reward_card_name_snapshot === "string" ? row.reward_card_name_snapshot : null,
    rewardLabel: typeof row.reward_label_snapshot === "string" ? row.reward_label_snapshot : null,
    missionTitle: toText(row.mission_title_snapshot),
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
    ({ ...rowToSubmission(row as unknown as Record<string, unknown>), reviewedBy: null }),
  );

  return missions.filter((mission) => mission.isActive || submissions.some((s) => s.missionId === mission.id)).map((mission) => {
    const userSubmissions = submissions.filter((s) => s.missionId === mission.id);
    const approvedCount = userSubmissions.filter((s) => s.status === "approved").length;
    const pendingCount = userSubmissions.filter((s) => s.status === "pending").length;
    const canSubmit =
      pendingCount === 0 && (userSubmissions.some((s) => s.status === "changes_requested") || (mission.isActive && approvedCount < mission.maxCompletionsPerUser));

    return {
      ...mission,
      userSubmissions,
      completedCount: approvedCount,
      canSubmit,
    };
  });
}

// ── Customer: submit a mission for review ──

export async function submitMissionProofInSupabase(input: MissionProofSubmissionInput): Promise<MissionSubmission> {
  if (!isMissionUuid(input.userId) || !isMissionUuid(input.missionId) || !isMissionUuid(input.requestKey) ||
    (input.submissionId && !isMissionUuid(input.submissionId)) ||
    (input.submissionId && (!Number.isSafeInteger(input.expectedRevision) || (input.expectedRevision ?? 0) < 1))) {
    throw new MissionRequestError("Données de participation invalides.");
  }
  const proofUrl = normalizeMissionProofUrl(input.proofUrl);
  const proofText = input.proofText?.trim() || "";
  if (proofText.length > MISSION_PROOF_TEXT_MAX_LENGTH) throw new MissionRequestError("Ton message est trop long.");
  if (input.proofStoragePath && !input.proofStoragePath.startsWith(input.userId + "/")) throw new MissionRequestError("Capture invalide.");
  const result = await createSupabaseServiceClient().rpc("rpc_submit_social_mission", {
    p_user_id: input.userId, p_mission_id: input.missionId, p_request_key: input.requestKey,
    p_submission_id: input.submissionId ?? null, p_expected_revision: input.expectedRevision ?? null,
    p_proof_url: proofUrl || null, p_proof_text: proofText || null,
    p_proof_storage_path: input.proofStoragePath || null, p_proof_content_type: input.proofContentType || null,
    p_proof_file_size: input.proofFileSize ?? null,
  });
  throwMissionRpcError(result.error);
  const data = result.data as { submission?: Record<string, unknown> } | null;
  if (!data?.submission) throw new MissionRequestError("Le service missions est indisponible. Réessaie avec le même envoi.", 503);
  return rowToSubmission(data.submission);
}

function throwMissionRpcError(error: { message: string; code?: string } | null): void {
  if (!error) return;
  const code = error.message.trim().toLowerCase();
  const messages: Record<string, [number, string]> = {
    mission_invalid_request: [400, "Données de participation invalides."],
    mission_invalid_review: [400, "Données de validation invalides."],
    mission_invalid_proof: [400, "La capture ou le lien est invalide."],
    mission_proof_required: [400, "Ajoute une capture pour cette mission."],
    mission_note_required: [400, "Ajoute un motif pour le refus ou la correction."],
    mission_not_found: [404, "Mission introuvable."],
    mission_submission_not_found: [404, "Participation introuvable."],
    mission_inactive: [409, "Cette mission n’accepte plus de nouvelles participations."],
    mission_already_pending: [409, "Tu as déjà une preuve en cours de vérification pour cette mission."],
    mission_already_reviewed: [409, "Cette participation a déjà été traitée. Actualise les missions."],
    mission_completion_limit: [409, "Tu as atteint le nombre de participations pour cette mission."],
    mission_request_key_reused: [409, "Cet envoi a changé. Actualise les missions avant de le renvoyer."],
    mission_reward_already_granted: [409, "La récompense a déjà été attribuée."],
    mission_stale_revision: [409, "La preuve a été modifiée. Actualise les missions avant de continuer."],
    mission_submission_not_correctable: [409, "Cette participation ne peut plus être corrigée."],
    mission_buddy_unavailable: [409, "Ce Buddy n’est plus disponible. La preuve reste en attente."],
    mission_collection_inactive: [409, "Cette collection est momentanément indisponible. La preuve reste en attente."],
    mission_invalid_reward: [409, "La récompense doit être vérifiée avant de continuer."],
    mission_profile_missing: [409, "Le compte joueur n’est plus disponible."],
    mission_wallet_limit: [409, "Le portefeuille du joueur ne permet pas cette attribution."],
  };
  const known = messages[code];
  if (known) throw new MissionRequestError(known[1], known[0], error.code === "P0001");
  console.error("[missions] transaction unavailable", { code: error.code });
  throw new MissionRequestError("Impossible de traiter cette demande pour le moment. Réessaie avec le même envoi.", 503);
}

async function listOpenMissionSubmissions(): Promise<Record<string, unknown>[]> {
  const supabase = createSupabaseServiceClient();
  const rows: Record<string, unknown>[] = [];
  const pageSize = 500;
  const cutoff = new Date().toISOString();
  for (let offset = 0; ; offset += pageSize) {
    const result = await supabase.from("social_mission_submissions").select(SELECT_MISSION_SUBMISSIONS_COLUMNS)
      .in("status", ["pending", "changes_requested"]).lte("created_at", cutoff)
      .order("created_at", { ascending: true }).order("id", { ascending: true }).range(offset, offset + pageSize - 1);
    failIfError(result.error, "open mission submissions");
    rows.push(...((result.data ?? []) as unknown as Record<string, unknown>[]));
    if ((result.data ?? []).length < pageSize) return rows;
  }
}

export async function getAdminMissionsOverviewFromSupabase(): Promise<AdminMissionsOverview> {
  const supabase = createSupabaseServiceClient();

  const [missionsResult, historyResult, openSubmissions] = await Promise.all([
    supabase
      .from("social_missions")
      .select(SELECT_SOCIAL_MISSIONS_COLUMNS)
      .order("sort_order", { ascending: true }),
    supabase
      .from("social_mission_submissions")
      .select(SELECT_MISSION_SUBMISSIONS_COLUMNS)
      .in("status", ["approved", "rejected"])
      .order("created_at", { ascending: false })
      .limit(300),
    listOpenMissionSubmissions(),
  ]);

  failIfError(missionsResult.error, "admin list missions");
  failIfError(historyResult.error, "admin list submissions");
  const submissionRows = [...openSubmissions, ...((historyResult.data ?? []) as unknown as Record<string, unknown>[])];

  const missions = (missionsResult.data ?? []).map((row) =>
    rowToMission(row as unknown as Record<string, unknown>),
  );
  const missionsById = new Map(missions.map((m) => [m.id, m]));

  const rawSubmissions = submissionRows.map((row) =>
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
  for (let offset = 0; offset < userIds.length; offset += 10) {
    const users = await Promise.all(userIds.slice(offset, offset + 10).map((id) => supabase.auth.admin.getUserById(id)));
    for (const result of users) {
      failIfError(result.error, "mission participant identity");
      if (result.data.user?.id) emailById.set(result.data.user.id, result.data.user.email ?? "");
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
      missionTitle: sub.missionTitle || mission?.title || "Mission inconnue",
      missionSlug: mission?.slug ?? "",
      proofSignedUrl: signedUrlById.get(sub.id) ?? null,
      legacyReview: submissionRows.some((row) => row.id === sub.id && row.review_version === 0),
    };
  });

  return {
    totalMissions: missions.length,
    totalSubmissions: rawSubmissions.length,
    pendingSubmissions: rawSubmissions.filter((s) => s.status === "pending").length,
    approvedSubmissions: rawSubmissions.filter((s) => s.status === "approved").length,
    rejectedSubmissions: rawSubmissions.filter((s) => s.status === "rejected").length,
    changesRequestedSubmissions: rawSubmissions.filter((s) => s.status === "changes_requested").length,
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
      reward_card_id: mission.rewardCardId,
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
    throw new MissionRequestError("Une mission avec ce slug existe deja.");
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
      reward_card_id: mission.rewardCardId,
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
    throw new MissionRequestError("Une mission avec ce slug existe deja.");
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

export async function reviewMissionSubmissionInSupabase(input: MissionReviewInput): Promise<void> {
  if (!isMissionUuid(input.submissionId) || !isMissionUuid(input.requestKey) || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) {
    throw new MissionRequestError("Données de validation invalides.");
  }
  const note = input.adminNote?.trim() || "";
  if (note.length > 2000 || (input.action !== "approve" && !note)) throw new MissionRequestError("Un motif est requis pour un refus ou une correction (2 000 caractères maximum).");
  const decision = input.action === "approve" ? "approved" : input.action === "reject" ? "rejected" : "changes_requested";
  const result = await createSupabaseServiceClient().rpc("rpc_review_social_mission", {
    p_submission_id: input.submissionId, p_expected_revision: input.expectedRevision,
    p_request_key: input.requestKey, p_decision: decision,
    p_admin_email: input.adminEmail, p_admin_note: note || null,
  });
  throwMissionRpcError(result.error);
}

export async function getMissionBuddyOptionsFromSupabase(): Promise<MissionBuddyOption[]> {
  const result = await createSupabaseServiceClient().from("lottery_card_definitions")
    .select("id,name,rarity,image_url,lottery_card_collections!inner(code,is_active)")
    .eq("is_active", true).eq("lottery_card_collections.code", "HEMP_HEROES_2026")
    .eq("lottery_card_collections.is_active", true).order("card_number", { ascending: true });
  failIfError(result.error, "mission buddy options");
  return (result.data ?? []).map((row) => ({
    id: toText(row.id), name: toText(row.name), rarity: toText(row.rarity), imageUrl: toText(row.image_url),
  }));
}

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
