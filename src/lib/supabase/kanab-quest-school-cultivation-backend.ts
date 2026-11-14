import "server-only";
import { createSupabaseServiceClient } from "./admin";
import { isKqSchoolUuid } from "../kanab-quest-school";
import { KqSchoolError } from "../kanab-quest-school-server";
import { VERSION } from "../kanab-quest-school-cultivation";
import { KQ_SCHOOL_CULTIVATION_LESSON_IDS, parseKqSchoolCultivationProgress,
  type KqSchoolCultivationProgressCommand, type KqSchoolCultivationSnapshot } from "../kanab-quest-school-cultivation-progress";

export async function getKqSchoolCultivation(userId: string, input?: KqSchoolCultivationProgressCommand): Promise<KqSchoolCultivationSnapshot> {
  if (!isKqSchoolUuid(userId)) throw new KqSchoolError("Session invalide.", 401);
  const command = input === undefined ? null : parseKqSchoolCultivationProgress(input);
  if (input !== undefined && !command) throw new KqSchoolError("Progression invalide.", 400);
  const { data, error } = await createSupabaseServiceClient().rpc("rpc_kq_school_cultivation", { p_user_id: userId, p_command: command });
  if (error) {
    if (/\bschool_cultivation_invalid\b/.test(error.message)) throw new KqSchoolError("Progression invalide.", 400);
    throw new Error("[school-cultivation] storage unavailable");
  }
  const snapshot = data as Omit<KqSchoolCultivationSnapshot, "contentVersion"> | null;
  if (!snapshot || snapshot.version !== 1 || snapshot.ownerId !== userId || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0
    || typeof snapshot.resumeConflict !== "boolean"
    || (snapshot.resumeLessonId !== null && !KQ_SCHOOL_CULTIVATION_LESSON_IDS.includes(snapshot.resumeLessonId))
    || (snapshot.updatedAt !== null && typeof snapshot.updatedAt !== "string")
    || !parseKqSchoolCultivationProgress({ lessonIds: snapshot.lessonIds, checkpointIds: snapshot.checkpointIds, activityIds: snapshot.activityIds })) {
    throw new Error("[school-cultivation] invalid snapshot");
  }
  return { ...snapshot, contentVersion: VERSION };
}
