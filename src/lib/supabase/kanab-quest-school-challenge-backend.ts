import "server-only";
import { createSupabaseServiceClient } from "./admin";
import { isKqSchoolUuid } from "../kanab-quest-school";
import { KqSchoolError } from "../kanab-quest-school-server";
import { createKqSchoolChallengePlan } from "../kanab-quest-school-challenge-server";
import { parseKqSchoolChallengeCommand, type KqSchoolChallengeCommand, type KqSchoolChallengeSnapshot } from "../kanab-quest-school-challenge";

export async function getKqSchoolChallenge(ownerId: string, input?: KqSchoolChallengeCommand): Promise<KqSchoolChallengeSnapshot> {
  if (!isKqSchoolUuid(ownerId)) throw new KqSchoolError("Session invalide.", 401);
  const command = input === undefined ? null : parseKqSchoolChallengeCommand(input);
  if (input !== undefined && !command) throw new KqSchoolError("Action de quiz invalide.", 400);
  const plan = command?.action === "start" ? createKqSchoolChallengePlan() : null;
  const { data, error } = await createSupabaseServiceClient().rpc("rpc_kq_school_challenge", { p_user_id: ownerId, p_command: command, p_plan: plan });
  if (error) {
    const code = /\b(school_challenge_(?:request_mismatch|round_changed|answer_locked|question_changed|answer_required))\b/.exec(error.message)?.[1];
    if (code) throw new KqSchoolError(code === "school_challenge_answer_locked" ? "Cette réponse est déjà fixée. Retrouve la partie enregistrée." : "La partie a changé. Retrouve son état avant de continuer.", 409, code);
    if (/\bschool_challenge_invalid\b/.test(error.message)) throw new KqSchoolError("Action de quiz invalide.", 400);
    throw new Error("[challenge] storage unavailable");
  }
  const value = data as KqSchoolChallengeSnapshot | null;
  if (!value || value.version !== 1 || value.ownerId !== ownerId || !Number.isFinite(Date.parse(value.serverNow))
    || !Number.isInteger(value.bestScore) || value.bestScore < 0 || value.bestScore > 3000 || !Number.isInteger(value.bestCorrectCount)
    || !Number.isInteger(value.completedCount) || value.completedCount < 0 || typeof value.replayed !== "boolean"
    || (value.round !== null && (!isKqSchoolUuid(value.round.id) || !["question", "feedback", "complete"].includes(value.round.status)
      || value.round.totalQuestions !== 20 || !Array.isArray(value.round.answers) || value.round.answers.length !== value.round.answeredCount
      || value.round.answeredCount > 20 || !Number.isInteger(value.round.score) || value.round.score < 0 || value.round.score > 3000
      || (value.round.status === "complete" ? value.round.question !== null : value.round.question?.options.length !== 4)))) throw new Error("[challenge] invalid snapshot");
  return value;
}
