/** Non-monetary learning checkpoints; never substitute these for rewarded scores. */
export const KQ_SCHOOL_BOTANY_CHAPTER_IDS = ["anatomy", "life-cycle", "sexual-expression", "observation", "taxonomy", "diversity", "genetics", "modern-lineages"] as const;
export const KQ_SCHOOL_BOTANY_LESSON_IDS = KQ_SCHOOL_BOTANY_CHAPTER_IDS.flatMap(id => [`botany-${id}-1`, `botany-${id}-2`]);
export const KQ_SCHOOL_BOTANY_CHECKPOINT_IDS = KQ_SCHOOL_BOTANY_CHAPTER_IDS.map(id => `botany-${id}-checkpoint`);
export const KQ_SCHOOL_BOTANY_ACTIVITY_IDS = KQ_SCHOOL_BOTANY_CHAPTER_IDS.flatMap(id => [`botany-${id}-activity-1`, `botany-${id}-activity-2`]);

export type KqSchoolBotanyProgressCommand = {
  lessonIds: string[]; checkpointIds: string[]; activityIds: string[];
  resumeLessonId?: string | null; expectedRevision?: number;
};
export type KqSchoolBotanySnapshot = {
  version: 1; ownerId: string; contentVersion: string;
  lessonIds: string[]; checkpointIds: string[]; activityIds: string[];
  resumeLessonId: string | null; revision: number; updatedAt: string | null;
  /** A stale tab still merges completions, but cannot overwrite a newer reading position. */
  resumeConflict: boolean;
};
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const ids = (value: unknown, allowed: readonly string[]): value is string[] => Array.isArray(value)
  && value.length <= allowed.length && value.every(id => typeof id === "string" && allowed.includes(id));

export function parseKqSchoolBotanyProgress(value: unknown): KqSchoolBotanyProgressCommand | null {
  if (!record(value)) return null;
  const hasPosition = Object.hasOwn(value, "resumeLessonId");
  const keys = ["lessonIds", "checkpointIds", "activityIds", ...(hasPosition ? ["resumeLessonId", "expectedRevision"] : [])];
  if (Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key))
    || !ids(value.lessonIds, KQ_SCHOOL_BOTANY_LESSON_IDS) || !ids(value.checkpointIds, KQ_SCHOOL_BOTANY_CHECKPOINT_IDS)
    || !ids(value.activityIds, KQ_SCHOOL_BOTANY_ACTIVITY_IDS)) return null;
  if (hasPosition && ((value.resumeLessonId !== null && (typeof value.resumeLessonId !== "string" || !KQ_SCHOOL_BOTANY_LESSON_IDS.includes(value.resumeLessonId)))
    || !Number.isSafeInteger(value.expectedRevision) || (value.expectedRevision as number) < 0)) return null;
  return { lessonIds: [...new Set(value.lessonIds)].sort(), checkpointIds: [...new Set(value.checkpointIds)].sort(), activityIds: [...new Set(value.activityIds)].sort(),
    ...(hasPosition ? { resumeLessonId: value.resumeLessonId as string | null, expectedRevision: value.expectedRevision as number } : {}) };
}
