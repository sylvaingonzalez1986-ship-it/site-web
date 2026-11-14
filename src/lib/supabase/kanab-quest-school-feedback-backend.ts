import "server-only";
import { createSupabaseServiceClient } from "./admin";
import { gradeKqSchoolQuestion, KqSchoolError } from "../kanab-quest-school-server";
import { isKqSchoolUuid } from "../kanab-quest-school";
import { parseKqSchoolCheck, type KqSchoolCheckSubmission, type KqSchoolQuestionFeedback } from "../kanab-quest-school-feedback";

export async function checkKqSchoolQuestion(ownerId: string, input: KqSchoolCheckSubmission): Promise<KqSchoolQuestionFeedback> {
  if (!isKqSchoolUuid(ownerId)) throw new KqSchoolError("Session invalide.", 401);
  const command = parseKqSchoolCheck(input);
  if (!command) throw new KqSchoolError("Réponse invalide.", 400);
  const correction = gradeKqSchoolQuestion(command, ownerId);
  const { data, error } = await createSupabaseServiceClient().rpc("rpc_kq_school_check", { p_user_id: ownerId, p_command: command, p_correction: correction });
  if (error) {
    if (/\bschool_feedback_locked\b/.test(error.message)) throw new KqSchoolError("Cette réponse est déjà validée. Reprends la tentative enregistrée ou recommence le quiz.", 409, "school_feedback_locked");
    if (/\bschool_feedback_mismatch\b/.test(error.message)) throw new KqSchoolError("Cette tentative correspond à un autre quiz. Recommence une nouvelle tentative.", 409, "school_request_mismatch");
    throw new Error("[school] feedback storage unavailable");
  }
  const result = data as { correction?: typeof correction; replayed?: boolean } | null;
  if (!result?.correction || result.correction.questionId !== command.questionId || result.correction.optionId !== command.optionId
    || typeof result.correction.isCorrect !== "boolean" || typeof result.correction.explanation !== "string" || typeof result.replayed !== "boolean") throw new Error("[school] invalid feedback");
  return { ownerId, requestKey: command.requestKey, correction: result.correction, replayed: result.replayed };
}
