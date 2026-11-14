import { describe, expect, it } from "vitest";
import { KQ_SCHOOL_TERPENES_LESSON_IDS, KQ_SCHOOL_TERPENES_CHECKPOINT_IDS, KQ_SCHOOL_TERPENES_ACTIVITY_IDS, parseKqSchoolTerpenesProgress } from "./kanab-quest-school-terpenes-progress";

const empty = () => ({ lessonIds: [], checkpointIds: [], activityIds: [] });
describe("terpenes progress contract", () => {
  it("contains only the 20 lessons, 10 checkpoints and 20 real activity identities", () => {
    expect(KQ_SCHOOL_TERPENES_LESSON_IDS).toHaveLength(20);
    expect(KQ_SCHOOL_TERPENES_CHECKPOINT_IDS).toHaveLength(10);
    expect(KQ_SCHOOL_TERPENES_ACTIVITY_IDS).toHaveLength(20);
    expect(parseKqSchoolTerpenesProgress({ lessonIds: KQ_SCHOOL_TERPENES_LESSON_IDS, checkpointIds: KQ_SCHOOL_TERPENES_CHECKPOINT_IDS, activityIds: KQ_SCHOOL_TERPENES_ACTIVITY_IDS })).not.toBeNull();
    expect(parseKqSchoolTerpenesProgress({ ...empty(), lessonIds: ["molecules"] })).toBeNull();
  });
  it("requires a revision for resume changes and deduplicates completion batches", () => {
    expect(parseKqSchoolTerpenesProgress({ ...empty(), lessonIds: ["terpenes-vocabulary-1", "terpenes-vocabulary-1"], resumeLessonId: "terpenes-vocabulary-2", expectedRevision: 0 }))
      .toEqual({ ...empty(), lessonIds: ["terpenes-vocabulary-1"], resumeLessonId: "terpenes-vocabulary-2", expectedRevision: 0 });
    expect(parseKqSchoolTerpenesProgress({ ...empty(), resumeLessonId: null, expectedRevision: 1 })).not.toBeNull();
    expect(parseKqSchoolTerpenesProgress({ ...empty(), resumeLessonId: "terpenes-vocabulary-1" })).toBeNull();
    expect(parseKqSchoolTerpenesProgress({ ...empty(), expectedRevision: 0 })).toBeNull();
  });
  it.each([
    { lessonIds: ["terpenes-fake-1"] }, { lessonIds: ["botany-anatomy-1"] }, { lessonIds: ["history-evidence-1"] },
    { checkpointIds: ["terpenes-vocabulary-1"] }, { activityIds: ["terpenes-vocabulary-activity-3"] },
    { score: 10 }, { answer: "free text must not be persisted" }, { userId: "other" },
    { resumeLessonId: "terpenes-vocabulary-1", expectedRevision: -1 }, { resumeLessonId: "terpenes-vocabulary-1", expectedRevision: 1.5 },
    { lessonIds: Array(21).fill("terpenes-vocabulary-1") }
  ])("rejects invalid, excessive or sensitive payload fields: %j", bad => {
    expect(parseKqSchoolTerpenesProgress({ ...empty(), ...bad })).toBeNull();
  });
});
