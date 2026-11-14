import { describe, expect, it } from "vitest";
import { KQ_SCHOOL_CULTIVATION_LESSON_IDS, KQ_SCHOOL_CULTIVATION_CHECKPOINT_IDS, KQ_SCHOOL_CULTIVATION_ACTIVITY_IDS, parseKqSchoolCultivationProgress } from "./kanab-quest-school-cultivation-progress";

const empty = () => ({ lessonIds: [], checkpointIds: [], activityIds: [] });
describe("cultivation progress contract", () => {
  it("contains only the 16 lessons, 8 checkpoints and 16 real activity identities", () => {
    expect(KQ_SCHOOL_CULTIVATION_LESSON_IDS).toHaveLength(16);
    expect(KQ_SCHOOL_CULTIVATION_CHECKPOINT_IDS).toHaveLength(8);
    expect(KQ_SCHOOL_CULTIVATION_ACTIVITY_IDS).toHaveLength(16);
    expect(parseKqSchoolCultivationProgress({ lessonIds: KQ_SCHOOL_CULTIVATION_LESSON_IDS, checkpointIds: KQ_SCHOOL_CULTIVATION_CHECKPOINT_IDS, activityIds: KQ_SCHOOL_CULTIVATION_ACTIVITY_IDS })).not.toBeNull();
    expect(parseKqSchoolCultivationProgress({ ...empty(), lessonIds: ["genetics"] })).toBeNull();
  });
  it("requires a revision for resume changes and deduplicates completion batches", () => {
    expect(parseKqSchoolCultivationProgress({ ...empty(), lessonIds: ["cultivation-axes-1", "cultivation-axes-1"], resumeLessonId: "cultivation-axes-2", expectedRevision: 0 }))
      .toEqual({ ...empty(), lessonIds: ["cultivation-axes-1"], resumeLessonId: "cultivation-axes-2", expectedRevision: 0 });
    expect(parseKqSchoolCultivationProgress({ ...empty(), resumeLessonId: null, expectedRevision: 1 })).not.toBeNull();
    expect(parseKqSchoolCultivationProgress({ ...empty(), resumeLessonId: "cultivation-axes-1" })).toBeNull();
    expect(parseKqSchoolCultivationProgress({ ...empty(), expectedRevision: 0 })).toBeNull();
  });
  it.each([
    { lessonIds: ["cultivation-fake-1"] }, { lessonIds: ["botany-anatomy-1"] }, { lessonIds: ["history-evidence-1"] },
    { lessonIds: ["terpenes-vocabulary-1"] }, { lessonIds: ["cannabinoids-origins-1"] },
    { checkpointIds: ["cultivation-axes-1"] }, { activityIds: ["cultivation-axes-activity-3"] },
    { score: 10 }, { answer: "free text must not be persisted" }, { userId: "other" },
    { resumeLessonId: "cultivation-axes-1", expectedRevision: -1 }, { resumeLessonId: "cultivation-axes-1", expectedRevision: 1.5 },
    { lessonIds: Array(17).fill("cultivation-axes-1") }
  ])("rejects invalid, excessive or sensitive payload fields: %j", bad => {
    expect(parseKqSchoolCultivationProgress({ ...empty(), ...bad })).toBeNull();
  });
});
