import "server-only";
import { createSupabaseServiceClient } from "./admin";
import { isKqSchoolUuid } from "../kanab-quest-school";
import { KqSchoolError } from "../kanab-quest-school-server";
import { CANNABINOID_VERSION as VERSION } from "../kanab-quest-school-cannabinoids";
import { KQ_SCHOOL_CANNABINOIDS_LESSON_IDS, parseKqSchoolCannabinoidsProgress,
  type KqSchoolCannabinoidsProgressCommand, type KqSchoolCannabinoidsSnapshot } from "../kanab-quest-school-cannabinoids-progress";

export async function getKqSchoolCannabinoids(userId: string, input?: KqSchoolCannabinoidsProgressCommand): Promise<KqSchoolCannabinoidsSnapshot> {
  if (!isKqSchoolUuid(userId)) throw new KqSchoolError("Session invalide.", 401);
  const command = input === undefined ? null : parseKqSchoolCannabinoidsProgress(input);
  if (input !== undefined && !command) throw new KqSchoolError("Progression invalide.", 400);
  const { data, error } = await createSupabaseServiceClient().rpc("rpc_kq_school_cannabinoids", { p_user_id: userId, p_command: command });
  if (error) {
    if (/\bschool_cannabinoids_invalid\b/.test(error.message)) throw new KqSchoolError("Progression invalide.", 400);
    throw new Error("[school-cannabinoids] storage unavailable");
  }
  const snapshot = data as Omit<KqSchoolCannabinoidsSnapshot, "contentVersion"> | null;
  if (!snapshot || snapshot.version !== 1 || snapshot.ownerId !== userId || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0
    || typeof snapshot.resumeConflict !== "boolean"
    || (snapshot.resumeLessonId !== null && !KQ_SCHOOL_CANNABINOIDS_LESSON_IDS.includes(snapshot.resumeLessonId))
    || (snapshot.updatedAt !== null && typeof snapshot.updatedAt !== "string")
    || !parseKqSchoolCannabinoidsProgress({ lessonIds: snapshot.lessonIds, checkpointIds: snapshot.checkpointIds, activityIds: snapshot.activityIds })) {
    throw new Error("[school-cannabinoids] invalid snapshot");
  }
  return { ...snapshot, contentVersion: VERSION };
}
