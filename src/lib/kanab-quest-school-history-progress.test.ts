import { describe, expect, it } from "vitest";
import { KQ_SCHOOL_HISTORY_LESSON_IDS, KQ_SCHOOL_HISTORY_CHECKPOINT_IDS, KQ_SCHOOL_HISTORY_ACTIVITY_IDS, parseKqSchoolHistoryProgress } from "./kanab-quest-school-history-progress";

const empty = () => ({ lessonIds: [], checkpointIds: [], activityIds: [] });
describe("history progress contract", () => {
  it("contains only the 22 lessons, 11 checkpoints and 22 real activity identities", () => {
    expect(KQ_SCHOOL_HISTORY_LESSON_IDS).toHaveLength(22);
    expect(KQ_SCHOOL_HISTORY_CHECKPOINT_IDS).toHaveLength(11);
    expect(KQ_SCHOOL_HISTORY_ACTIVITY_IDS).toHaveLength(22);
    expect(parseKqSchoolHistoryProgress({ lessonIds: KQ_SCHOOL_HISTORY_LESSON_IDS, checkpointIds: KQ_SCHOOL_HISTORY_CHECKPOINT_IDS, activityIds: KQ_SCHOOL_HISTORY_ACTIVITY_IDS })).not.toBeNull();
    expect(parseKqSchoolHistoryProgress({ ...empty(), lessonIds: ["history"] })).toBeNull();
  });
  it("requires a revision for resume changes and deduplicates completion batches", () => {
    expect(parseKqSchoolHistoryProgress({ ...empty(), lessonIds: ["history-evidence-1", "history-evidence-1"], resumeLessonId: "history-evidence-2", expectedRevision: 0 }))
      .toEqual({ ...empty(), lessonIds: ["history-evidence-1"], resumeLessonId: "history-evidence-2", expectedRevision: 0 });
    expect(parseKqSchoolHistoryProgress({ ...empty(), resumeLessonId: null, expectedRevision: 1 })).not.toBeNull();
    expect(parseKqSchoolHistoryProgress({ ...empty(), resumeLessonId: "history-evidence-1" })).toBeNull();
    expect(parseKqSchoolHistoryProgress({ ...empty(), expectedRevision: 0 })).toBeNull();
  });
  it.each([
    { lessonIds: ["history-fake-1"] }, { checkpointIds: ["history-evidence-1"] }, { activityIds: ["history-evidence-activity-3"] },
    { score: 10 }, { answer: "free text must not be persisted" }, { userId: "other" },
    { resumeLessonId: "history-evidence-1", expectedRevision: -1 }, { resumeLessonId: "history-evidence-1", expectedRevision: 1.5 },
    { lessonIds: Array(23).fill("history-evidence-1") }
  ])("rejects invalid, excessive or sensitive payload fields: %j", bad => {
    expect(parseKqSchoolHistoryProgress({ ...empty(), ...bad })).toBeNull();
  });
});
