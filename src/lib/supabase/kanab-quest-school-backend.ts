import "server-only";
import { createSupabaseServiceClient } from "./admin";
import { gradeKqSchoolSubmission, KqSchoolError } from "../kanab-quest-school-server";
import { isKqSchoolUuid, parseKqSchoolProgress, parseKqSchoolSubmission,
  type KqSchoolCompletion, type KqSchoolProgress, type KqSchoolSnapshot, type KqSchoolSubmission } from "../kanab-quest-school";

async function schoolRpc(userId: string, command: Record<string, unknown> | null = null, grading: ReturnType<typeof gradeKqSchoolSubmission> = null, selectionId?: string) {
  if (!isKqSchoolUuid(userId)) throw new KqSchoolError("Session invalide.", 401);
  const submitting = command?.action === "submit";
  const { data, error } = await createSupabaseServiceClient().rpc(submitting ? "rpc_kq_school_submit_checked" : "rpc_kq_school", { p_user_id: userId, p_command: command, p_grading: grading, ...(submitting ? { p_selection_id: selectionId ?? null } : {}) });
  if (error) {
    const messages: Record<string, [string, number]> = {
      school_feedback_locked: ["Une r\u00e9ponse valid\u00e9e a chang\u00e9. Reprends le quiz enregistr\u00e9.", 409],
      school_feedback_incomplete: ["Valide chaque r\u00e9ponse avant de terminer le quiz.", 409],
      school_feedback_mismatch: ["Le quiz ne correspond plus \u00e0 cette tentative.", 409],
      school_profile: ["Commence ton aventure dans le Quartier pour enregistrer ta progression.", 403],
      school_request_mismatch: ["Cette tentative a déjà été validée avec d’autres réponses. Retrouve son résultat ou commence une nouvelle tentative.", 409],
      school_version: ["Ce quiz a été actualisé. Recharge-le avant de répondre à nouveau.", 409],
      school_wallet_limit: ["Ton portefeuille a atteint son plafond. Libère de la place puis renvoie cette tentative.", 409],
      school_invalid: ["La tentative ou la progression est invalide.", 400],
    };
    for (const [code, [message, status]] of Object.entries(messages)) if (new RegExp(`\\b${code}\\b`).test(error.message)) throw new KqSchoolError(message, status, code === "school_version" ? "CONTENT_VERSION_CHANGED" : code);
    throw new Error("[school] storage unavailable");
  }
  return data as unknown;
}

function isSnapshot(value: unknown): value is KqSchoolSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as KqSchoolSnapshot;
  return snapshot.version === 1 && isKqSchoolUuid(snapshot.ownerId) && Number.isSafeInteger(snapshot.cashCents) && snapshot.cashCents >= 0
    && Array.isArray(snapshot.lessonIds) && Array.isArray(snapshot.workshopIds)
    && Array.isArray(snapshot.quizzes) && snapshot.quizzes.length === 10
    && Number.isSafeInteger(snapshot.totalBudgetCents) && Number.isSafeInteger(snapshot.totalPaidCents);
}

export async function getKqSchoolSnapshot(userId: string): Promise<KqSchoolSnapshot> {
  const data = await schoolRpc(userId);
  if (!isSnapshot(data)) throw new Error("[school] invalid snapshot");
  return data;
}

export async function saveKqSchoolProgress(userId: string, input: KqSchoolProgress): Promise<KqSchoolSnapshot> {
  const progress = parseKqSchoolProgress(input);
  if (!progress) throw new KqSchoolError("Progression invalide.", 400);
  const data = await schoolRpc(userId, { action: "progress", ...progress });
  if (!isSnapshot(data)) throw new Error("[school] invalid snapshot");
  return data;
}

export async function submitKqSchoolQuiz(userId: string, input: KqSchoolSubmission): Promise<KqSchoolCompletion> {
  const submission = parseKqSchoolSubmission(input);
  if (!submission) throw new KqSchoolError("Tentative invalide.", 400);
  const grading = gradeKqSchoolSubmission(submission, userId);
  // The signed selector only authorizes the server's question plan. SQL already
  // persists its exact ten answers and version, preserving its original command
  // and receipt format; no financial migration or reward identity reset is needed.
  const command = { action: "submit", requestKey: submission.requestKey, quizId: submission.quizId,
    contentVersion: submission.contentVersion, answers: submission.answers };
  const data = await schoolRpc(userId, command, grading, submission.selectionId) as KqSchoolCompletion | null;
  if (!data || !isSnapshot(data.snapshot) || typeof data.replayed !== "boolean" || !data.result
    || !Number.isInteger(data.result.score) || data.result.score < 0 || data.result.score > 10
    || !Number.isSafeInteger(data.result.gainCents) || !Array.isArray(data.result.corrections) || data.result.corrections.length !== 10) throw new Error("[school] invalid receipt");
  return data;
}
