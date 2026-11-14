import "server-only";
import { createSupabaseServiceClient } from "./admin";
import { isKqSchoolUuid } from "../kanab-quest-school";
import { KqSchoolError } from "../kanab-quest-school-server";
import { VERSION } from "../kanab-quest-school-botany";
import { KQ_SCHOOL_BOTANY_LESSON_IDS, parseKqSchoolBotanyProgress,
  type KqSchoolBotanyProgressCommand, type KqSchoolBotanySnapshot } from "../kanab-quest-school-botany-progress";

export async function getKqSchoolBotany(userId: string, input?: KqSchoolBotanyProgressCommand): Promise<KqSchoolBotanySnapshot> {
  if (!isKqSchoolUuid(userId)) throw new KqSchoolError("Session invalide.", 401);
  const command = input === undefined ? null : parseKqSchoolBotanyProgress(input);
  if (input !== undefined && !command) throw new KqSchoolError("Progression botanique invalide.", 400);
  const { data, error } = await createSupabaseServiceClient().rpc("rpc_kq_school_botany", { p_user_id: userId, p_command: command });
  if (error) {
    if (/\bschool_botany_invalid\b/.test(error.message)) throw new KqSchoolError("Progression botanique invalide.", 400);
    throw new Error("[school-botany] storage unavailable");
  }
  const snapshot = data as Omit<KqSchoolBotanySnapshot, "contentVersion"> | null;
  if (!snapshot || snapshot.version !== 1 || snapshot.ownerId !== userId || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0
    || typeof snapshot.resumeConflict !== "boolean"
    || (snapshot.resumeLessonId !== null && !KQ_SCHOOL_BOTANY_LESSON_IDS.includes(snapshot.resumeLessonId))
    || (snapshot.updatedAt !== null && typeof snapshot.updatedAt !== "string")
    || !parseKqSchoolBotanyProgress({ lessonIds: snapshot.lessonIds, checkpointIds: snapshot.checkpointIds, activityIds: snapshot.activityIds })) {
    throw new Error("[school-botany] invalid snapshot");
  }
  return { ...snapshot, contentVersion: VERSION };
}
