/** Non-monetary learning checkpoints; never substitute these for rewarded scores. */
export const KQ_SCHOOL_SOIL_CHAPTER_IDS = ["physical", "rhizosphere", "life", "organic", "nutrients", "measures", "inputs", "amendments", "analysis", "hemp"] as const;
export const KQ_SCHOOL_SOIL_LESSON_IDS = KQ_SCHOOL_SOIL_CHAPTER_IDS.flatMap(id => [`soil-${id}-1`, `soil-${id}-2`]);
export const KQ_SCHOOL_SOIL_CHECKPOINT_IDS = KQ_SCHOOL_SOIL_CHAPTER_IDS.map(id => `soil-${id}-checkpoint`);
export const KQ_SCHOOL_SOIL_ACTIVITY_IDS = KQ_SCHOOL_SOIL_CHAPTER_IDS.flatMap(id => [`soil-${id}-activity-1`, `soil-${id}-activity-2`]);

export type KqSchoolSoilProgressCommand = {
  lessonIds: string[]; checkpointIds: string[]; activityIds: string[];
  resumeLessonId?: string | null; expectedRevision?: number;
};
export type KqSchoolSoilSnapshot = {
  version: 1; ownerId: string; contentVersion: string;
  lessonIds: string[]; checkpointIds: string[]; activityIds: string[];
  resumeLessonId: string | null; revision: number; updatedAt: string | null;
  /** A stale tab still merges completions, but cannot overwrite a newer reading position. */
  resumeConflict: boolean;
};
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const ids = (value: unknown, allowed: readonly string[]): value is string[] => Array.isArray(value)
  && value.length <= allowed.length && value.every(id => typeof id === "string" && allowed.includes(id));

export function parseKqSchoolSoilProgress(value: unknown): KqSchoolSoilProgressCommand | null {
  if (!record(value)) return null;
  const hasPosition = Object.hasOwn(value, "resumeLessonId");
  const keys = ["lessonIds", "checkpointIds", "activityIds", ...(hasPosition ? ["resumeLessonId", "expectedRevision"] : [])];
  if (Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key))
    || !ids(value.lessonIds, KQ_SCHOOL_SOIL_LESSON_IDS) || !ids(value.checkpointIds, KQ_SCHOOL_SOIL_CHECKPOINT_IDS)
    || !ids(value.activityIds, KQ_SCHOOL_SOIL_ACTIVITY_IDS)) return null;
  if (hasPosition && ((value.resumeLessonId !== null && (typeof value.resumeLessonId !== "string" || !KQ_SCHOOL_SOIL_LESSON_IDS.includes(value.resumeLessonId)))
    || !Number.isSafeInteger(value.expectedRevision) || (value.expectedRevision as number) < 0)) return null;
  return { lessonIds: [...new Set(value.lessonIds)].sort(), checkpointIds: [...new Set(value.checkpointIds)].sort(), activityIds: [...new Set(value.activityIds)].sort(),
    ...(hasPosition ? { resumeLessonId: value.resumeLessonId as string | null, expectedRevision: value.expectedRevision as number } : {}) };
}
