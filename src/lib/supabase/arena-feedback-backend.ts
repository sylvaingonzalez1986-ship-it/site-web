import "server-only";
import {
  ArenaFeedbackError, isArenaFeedbackKind, isArenaFeedbackStatus,
  type AdminArenaFeedback, type ArenaFeedback, type ArenaFeedbackKind, type ArenaFeedbackList,
  type ArenaFeedbackReview, type ArenaFeedbackStatus, type ArenaFeedbackSubmission,
} from "@/lib/arena-feedback";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";

const PLAYER_COLUMNS = "id,kind,subject,message,page_path,status,reply,reward_packs,reward_granted_at,created_at,updated_at";
const ADMIN_COLUMNS = `${PLAYER_COLUMNS},user_id,reviewed_by`;
function failure(error: { message: string }): never {
  const known: Array<[string, string, number, number?]> = [
    ["feedback_request_conflict", "Cette demande existe déjà avec un autre contenu. Actualise avant de réessayer.", 409],
    ["feedback_daily_limit", "Tu as déjà envoyé 5 messages en 24 heures. Réessaie demain.", 429, 86400],
    ["feedback_cooldown", "Patiente une minute entre deux messages.", 429, 60],
    ["feedback_not_found", "Ce message est introuvable.", 404],
    ["feedback_reward_conflict", "Une récompense a déjà été attribuée à ce message. Son montant ne peut plus changer.", 409],
    ["feedback_changed", "Ce message a été modifié. Recharge-le avant de réessayer.", 409],
    ["feedback_invalid", "La demande contient une valeur invalide.", 400],
  ];
  const match = known.find(([code]) => error.message.includes(code));
  if (match) throw new ArenaFeedbackError(match[1], match[2], match[3]);
  throw new Error("Arena feedback storage unavailable");
}
function row(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid feedback response");
  return value as Record<string, unknown>;
}
function playerItem(value: unknown): ArenaFeedback {
  const data = row(value);
  if (typeof data.id !== "string" || !isArenaFeedbackKind(data.kind) || !isArenaFeedbackStatus(data.status)
    || typeof data.subject !== "string" || typeof data.message !== "string"
    || typeof data.created_at !== "string" || typeof data.updated_at !== "string"
    || !Number.isInteger(data.reward_packs) || Number(data.reward_packs) < 0 || Number(data.reward_packs) > 5) {
    throw new Error("Invalid feedback response");
  }
  return { id: data.id, kind: data.kind, subject: data.subject, message: data.message,
    pagePath: typeof data.page_path === "string" ? data.page_path : null, status: data.status,
    reply: typeof data.reply === "string" ? data.reply : null, rewardPacks: Number(data.reward_packs),
    rewardGrantedAt: typeof data.reward_granted_at === "string" ? data.reward_granted_at : null,
    createdAt: data.created_at, updatedAt: data.updated_at };
}
function adminItem(value: unknown): AdminArenaFeedback {
  const data = row(value);
  if (typeof data.user_id !== "string") throw new Error("Invalid feedback response");
  return { ...playerItem(value), userId: data.user_id, reviewedBy: typeof data.reviewed_by === "string" ? data.reviewed_by : null };
}

export async function getPlayerArenaFeedback(userId: string, offset = 0): Promise<ArenaFeedbackList> {
  const result = await createSupabaseServiceClient().from("arena_feedback")
    .select(PLAYER_COLUMNS, { count: "exact" }).eq("user_id", userId)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 19);
  if (result.error) failure(result.error);
  if (!Array.isArray(result.data) || !Number.isInteger(result.count) || Number(result.count) < 0) throw new Error("Invalid feedback list response");
  const items = result.data.map(playerItem);
  const total = Number(result.count);
  return { items, total, hasMore: offset + items.length < total };
}
export async function submitArenaFeedback(userId: string, submission: ArenaFeedbackSubmission) {
  const result = await createSupabaseServiceClient().rpc("rpc_arena_submit_feedback", {
    p_user_id: userId, p_request_id: submission.requestId, p_kind: submission.kind,
    p_subject: submission.subject, p_message: submission.message, p_page_path: submission.pagePath,
  });
  if (result.error) failure(result.error);
  const data = row(result.data);
  return { item: playerItem(data.item), replayed: data.replayed === true };
}
export async function getAdminArenaFeedback(options: {
  offset: number; status?: ArenaFeedbackStatus; kind?: ArenaFeedbackKind;
}): Promise<ArenaFeedbackList<AdminArenaFeedback>> {
  let query = createSupabaseServiceClient().from("arena_feedback").select(ADMIN_COLUMNS, { count: "exact" });
  if (options.status) query = query.eq("status", options.status);
  if (options.kind) query = query.eq("kind", options.kind);
  const result = await query.order("created_at", { ascending: false }).order("id", { ascending: false })
    .range(options.offset, options.offset + 29);
  if (result.error) failure(result.error);
  if (!Array.isArray(result.data) || !Number.isInteger(result.count) || Number(result.count) < 0) throw new Error("Invalid feedback list response");
  const items = result.data.map(adminItem);
  const total = Number(result.count);
  return { items, total, hasMore: options.offset + items.length < total };
}
export async function reviewArenaFeedback(reviewedBy: string, review: ArenaFeedbackReview) {
  const result = await createSupabaseServiceClient().rpc("rpc_arena_review_feedback", {
    p_id: review.id, p_status: review.status, p_reply: review.reply,
    p_reward_packs: review.rewardPacks, p_reviewed_by: reviewedBy, p_expected_updated_at: review.expectedUpdatedAt,
  });
  if (result.error) failure(result.error);
  const data = row(result.data);
  return { item: adminItem(data.item), rewardGranted: data.rewardGranted === true };
}
