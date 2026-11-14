import "server-only";
import { createSupabaseServiceClient } from "./admin";
import { isKqSchoolUuid } from "../kanab-quest-school";
import { KqSchoolError } from "../kanab-quest-school-server";
import { VERSION } from "../kanab-quest-school-history";
import { KQ_SCHOOL_HISTORY_LESSON_IDS, parseKqSchoolHistoryProgress,
  type KqSchoolHistoryProgressCommand, type KqSchoolHistorySnapshot } from "../kanab-quest-school-history-progress";

export async function getKqSchoolHistory(userId: string, input?: KqSchoolHistoryProgressCommand): Promise<KqSchoolHistorySnapshot> {
  if (!isKqSchoolUuid(userId)) throw new KqSchoolError("Session invalide.", 401);
  const command = input === undefined ? null : parseKqSchoolHistoryProgress(input);
  if (input !== undefined && !command) throw new KqSchoolError("Progression historique invalide.", 400);
  const { data, error } = await createSupabaseServiceClient().rpc("rpc_kq_school_history", { p_user_id: userId, p_command: command });
  if (error) {
    if (/\bschool_history_invalid\b/.test(error.message)) throw new KqSchoolError("Progression historique invalide.", 400);
    throw new Error("[school-history] storage unavailable");
  }
  const snapshot = data as Omit<KqSchoolHistorySnapshot, "contentVersion"> | null;
  if (!snapshot || snapshot.version !== 1 || snapshot.ownerId !== userId || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0
    || typeof snapshot.resumeConflict !== "boolean"
    || (snapshot.resumeLessonId !== null && !KQ_SCHOOL_HISTORY_LESSON_IDS.includes(snapshot.resumeLessonId))
    || (snapshot.updatedAt !== null && typeof snapshot.updatedAt !== "string")
    || !parseKqSchoolHistoryProgress({ lessonIds: snapshot.lessonIds, checkpointIds: snapshot.checkpointIds, activityIds: snapshot.activityIds })) {
    throw new Error("[school-history] invalid snapshot");
  }
  return { ...snapshot, contentVersion: VERSION };
}
