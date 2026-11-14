import "server-only";
import { createSupabaseServiceClient } from "./admin";
import { isKqSchoolUuid } from "../kanab-quest-school";
import { KqSchoolError } from "../kanab-quest-school-server";
import { VERSION } from "../kanab-quest-school-harvest";
import { KQ_SCHOOL_HARVEST_LESSON_IDS, parseKqSchoolHarvestProgress,
  type KqSchoolHarvestProgressCommand, type KqSchoolHarvestSnapshot } from "../kanab-quest-school-harvest-progress";

export async function getKqSchoolHarvest(userId: string, input?: KqSchoolHarvestProgressCommand): Promise<KqSchoolHarvestSnapshot> {
  if (!isKqSchoolUuid(userId)) throw new KqSchoolError("Session invalide.", 401);
  const command = input === undefined ? null : parseKqSchoolHarvestProgress(input);
  if (input !== undefined && !command) throw new KqSchoolError("Progression invalide.", 400);
  const { data, error } = await createSupabaseServiceClient().rpc("rpc_kq_school_harvest", { p_user_id: userId, p_command: command });
  if (error) {
    if (/\bschool_harvest_invalid\b/.test(error.message)) throw new KqSchoolError("Progression invalide.", 400);
    throw new Error("[school-harvest] storage unavailable");
  }
  const snapshot = data as Omit<KqSchoolHarvestSnapshot, "contentVersion"> | null;
  if (!snapshot || snapshot.version !== 1 || snapshot.ownerId !== userId || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0
    || typeof snapshot.resumeConflict !== "boolean"
    || (snapshot.resumeLessonId !== null && !KQ_SCHOOL_HARVEST_LESSON_IDS.includes(snapshot.resumeLessonId))
    || (snapshot.updatedAt !== null && typeof snapshot.updatedAt !== "string")
    || !parseKqSchoolHarvestProgress({ lessonIds: snapshot.lessonIds, checkpointIds: snapshot.checkpointIds, activityIds: snapshot.activityIds })) {
    throw new Error("[school-harvest] invalid snapshot");
  }
  return { ...snapshot, contentVersion: VERSION };
}
