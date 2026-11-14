import { describe, expect, it } from "vitest";
import { KQ_SCHOOL_HEALTH_LESSON_IDS, KQ_SCHOOL_HEALTH_CHECKPOINT_IDS, KQ_SCHOOL_HEALTH_ACTIVITY_IDS, parseKqSchoolHealthProgress } from "./kanab-quest-school-health-progress";

const empty = () => ({ lessonIds: [], checkpointIds: [], activityIds: [] });
describe("health progress contract", () => {
  it("contains only the 16 lessons, 8 checkpoints and 16 real activity identities", () => {
    expect(KQ_SCHOOL_HEALTH_LESSON_IDS).toHaveLength(16);
    expect(KQ_SCHOOL_HEALTH_CHECKPOINT_IDS).toHaveLength(8);
    expect(KQ_SCHOOL_HEALTH_ACTIVITY_IDS).toHaveLength(16);
    expect(parseKqSchoolHealthProgress({ lessonIds: KQ_SCHOOL_HEALTH_LESSON_IDS, checkpointIds: KQ_SCHOOL_HEALTH_CHECKPOINT_IDS, activityIds: KQ_SCHOOL_HEALTH_ACTIVITY_IDS })).not.toBeNull();
    expect(parseKqSchoolHealthProgress({ ...empty(), lessonIds: ["biodiversity"] })).toBeNull();
  });
  it("requires a revision for resume changes and deduplicates completion batches", () => {
    expect(parseKqSchoolHealthProgress({ ...empty(), lessonIds: ["health-observation-1", "health-observation-1"], resumeLessonId: "health-observation-2", expectedRevision: 0 }))
      .toEqual({ ...empty(), lessonIds: ["health-observation-1"], resumeLessonId: "health-observation-2", expectedRevision: 0 });
    expect(parseKqSchoolHealthProgress({ ...empty(), resumeLessonId: null, expectedRevision: 1 })).not.toBeNull();
    expect(parseKqSchoolHealthProgress({ ...empty(), resumeLessonId: "health-observation-1" })).toBeNull();
    expect(parseKqSchoolHealthProgress({ ...empty(), expectedRevision: 0 })).toBeNull();
  });
  it.each([
    { lessonIds: ["health-fake-1"] }, { lessonIds: ["cultivation-axes-1"] }, { lessonIds: ["botany-anatomy-1"] }, { lessonIds: ["history-evidence-1"] },
    { lessonIds: ["terpenes-vocabulary-1"] }, { lessonIds: ["cannabinoids-origins-1"] },
    { checkpointIds: ["health-observation-1"] }, { activityIds: ["health-observation-activity-3"] },
    { score: 10 }, { answer: "free text must not be persisted" }, { userId: "other" },
    { resumeLessonId: "health-observation-1", expectedRevision: -1 }, { resumeLessonId: "health-observation-1", expectedRevision: 1.5 },
    { lessonIds: Array(17).fill("health-observation-1") }
  ])("rejects invalid, excessive or sensitive payload fields: %j", bad => {
    expect(parseKqSchoolHealthProgress({ ...empty(), ...bad })).toBeNull();
  });
});
