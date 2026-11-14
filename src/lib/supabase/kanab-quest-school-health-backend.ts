import "server-only";
import { createSupabaseServiceClient } from "./admin";
import { isKqSchoolUuid } from "../kanab-quest-school";
import { KqSchoolError } from "../kanab-quest-school-server";
import { VERSION } from "../kanab-quest-school-health";
import { KQ_SCHOOL_HEALTH_LESSON_IDS, parseKqSchoolHealthProgress,
  type KqSchoolHealthProgressCommand, type KqSchoolHealthSnapshot } from "../kanab-quest-school-health-progress";

export async function getKqSchoolHealth(userId: string, input?: KqSchoolHealthProgressCommand): Promise<KqSchoolHealthSnapshot> {
  if (!isKqSchoolUuid(userId)) throw new KqSchoolError("Session invalide.", 401);
  const command = input === undefined ? null : parseKqSchoolHealthProgress(input);
  if (input !== undefined && !command) throw new KqSchoolError("Progression invalide.", 400);
  const { data, error } = await createSupabaseServiceClient().rpc("rpc_kq_school_health", { p_user_id: userId, p_command: command });
  if (error) {
    if (/\bschool_health_invalid\b/.test(error.message)) throw new KqSchoolError("Progression invalide.", 400);
    throw new Error("[school-health] storage unavailable");
  }
  const snapshot = data as Omit<KqSchoolHealthSnapshot, "contentVersion"> | null;
  if (!snapshot || snapshot.version !== 1 || snapshot.ownerId !== userId || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0
    || typeof snapshot.resumeConflict !== "boolean"
    || (snapshot.resumeLessonId !== null && !KQ_SCHOOL_HEALTH_LESSON_IDS.includes(snapshot.resumeLessonId))
    || (snapshot.updatedAt !== null && typeof snapshot.updatedAt !== "string")
    || !parseKqSchoolHealthProgress({ lessonIds: snapshot.lessonIds, checkpointIds: snapshot.checkpointIds, activityIds: snapshot.activityIds })) {
    throw new Error("[school-health] invalid snapshot");
  }
  return { ...snapshot, contentVersion: VERSION };
}
