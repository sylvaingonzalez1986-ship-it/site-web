import "server-only";
import { createSupabaseServiceClient } from "./admin";
import { isKqSchoolUuid } from "../kanab-quest-school";
import { KqSchoolError } from "../kanab-quest-school-server";
import { VERSION } from "../kanab-quest-school-products";
import { KQ_SCHOOL_PRODUCTS_LESSON_IDS, parseKqSchoolProductsProgress,
  type KqSchoolProductsProgressCommand, type KqSchoolProductsSnapshot } from "../kanab-quest-school-products-progress";

export async function getKqSchoolProducts(userId: string, input?: KqSchoolProductsProgressCommand): Promise<KqSchoolProductsSnapshot> {
  if (!isKqSchoolUuid(userId)) throw new KqSchoolError("Session invalide.", 401);
  const command = input === undefined ? null : parseKqSchoolProductsProgress(input);
  if (input !== undefined && !command) throw new KqSchoolError("Progression invalide.", 400);
  const { data, error } = await createSupabaseServiceClient().rpc("rpc_kq_school_products", { p_user_id: userId, p_command: command });
  if (error) {
    if (/\bschool_products_invalid\b/.test(error.message)) throw new KqSchoolError("Progression invalide.", 400);
    throw new Error("[school-products] storage unavailable");
  }
  const snapshot = data as Omit<KqSchoolProductsSnapshot, "contentVersion"> | null;
  if (!snapshot || snapshot.version !== 1 || snapshot.ownerId !== userId || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0
    || typeof snapshot.resumeConflict !== "boolean"
    || (snapshot.resumeLessonId !== null && !KQ_SCHOOL_PRODUCTS_LESSON_IDS.includes(snapshot.resumeLessonId))
    || (snapshot.updatedAt !== null && typeof snapshot.updatedAt !== "string")
    || !parseKqSchoolProductsProgress({ lessonIds: snapshot.lessonIds, checkpointIds: snapshot.checkpointIds, activityIds: snapshot.activityIds })) {
    throw new Error("[school-products] invalid snapshot");
  }
  return { ...snapshot, contentVersion: VERSION };
}
