import "server-only";
import { createSupabaseServiceClient } from "./admin";
import { isKqSchoolUuid } from "../kanab-quest-school";
import { KqSchoolError } from "../kanab-quest-school-server";
import { VERSION } from "../kanab-quest-school-soil";
import { KQ_SCHOOL_SOIL_LESSON_IDS, parseKqSchoolSoilProgress,
  type KqSchoolSoilProgressCommand, type KqSchoolSoilSnapshot } from "../kanab-quest-school-soil-progress";

export async function getKqSchoolSoil(userId: string, input?: KqSchoolSoilProgressCommand): Promise<KqSchoolSoilSnapshot> {
  if (!isKqSchoolUuid(userId)) throw new KqSchoolError("Session invalide.", 401);
  const command = input === undefined ? null : parseKqSchoolSoilProgress(input);
  if (input !== undefined && !command) throw new KqSchoolError("Progression invalide.", 400);
  const { data, error } = await createSupabaseServiceClient().rpc("rpc_kq_school_soil", { p_user_id: userId, p_command: command });
  if (error) {
    if (/\bschool_soil_invalid\b/.test(error.message)) throw new KqSchoolError("Progression invalide.", 400);
    throw new Error("[school-soil] storage unavailable");
  }
  const snapshot = data as Omit<KqSchoolSoilSnapshot, "contentVersion"> | null;
  if (!snapshot || snapshot.version !== 1 || snapshot.ownerId !== userId || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0
    || typeof snapshot.resumeConflict !== "boolean"
    || (snapshot.resumeLessonId !== null && !KQ_SCHOOL_SOIL_LESSON_IDS.includes(snapshot.resumeLessonId))
    || (snapshot.updatedAt !== null && typeof snapshot.updatedAt !== "string")
    || !parseKqSchoolSoilProgress({ lessonIds: snapshot.lessonIds, checkpointIds: snapshot.checkpointIds, activityIds: snapshot.activityIds })) {
    throw new Error("[school-soil] invalid snapshot");
  }
  return { ...snapshot, contentVersion: VERSION };
}
