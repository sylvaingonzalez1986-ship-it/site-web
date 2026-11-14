import { describe, expect, it } from "vitest";
import { KQ_SCHOOL_CANNABINOIDS_LESSON_IDS, KQ_SCHOOL_CANNABINOIDS_CHECKPOINT_IDS, KQ_SCHOOL_CANNABINOIDS_ACTIVITY_IDS, parseKqSchoolCannabinoidsProgress } from "./kanab-quest-school-cannabinoids-progress";

const empty = () => ({ lessonIds: [], checkpointIds: [], activityIds: [] });
describe("cannabinoids progress contract", () => {
  it("contains only the 20 lessons, 10 checkpoints and 20 real activity identities", () => {
    expect(KQ_SCHOOL_CANNABINOIDS_LESSON_IDS).toHaveLength(20);
    expect(KQ_SCHOOL_CANNABINOIDS_CHECKPOINT_IDS).toHaveLength(10);
    expect(KQ_SCHOOL_CANNABINOIDS_ACTIVITY_IDS).toHaveLength(20);
    expect(parseKqSchoolCannabinoidsProgress({ lessonIds: KQ_SCHOOL_CANNABINOIDS_LESSON_IDS, checkpointIds: KQ_SCHOOL_CANNABINOIDS_CHECKPOINT_IDS, activityIds: KQ_SCHOOL_CANNABINOIDS_ACTIVITY_IDS })).not.toBeNull();
    expect(parseKqSchoolCannabinoidsProgress({ ...empty(), lessonIds: ["evidence"] })).toBeNull();
  });
  it("requires a revision for resume changes and deduplicates completion batches", () => {
    expect(parseKqSchoolCannabinoidsProgress({ ...empty(), lessonIds: ["cannabinoids-origins-1", "cannabinoids-origins-1"], resumeLessonId: "cannabinoids-origins-2", expectedRevision: 0 }))
      .toEqual({ ...empty(), lessonIds: ["cannabinoids-origins-1"], resumeLessonId: "cannabinoids-origins-2", expectedRevision: 0 });
    expect(parseKqSchoolCannabinoidsProgress({ ...empty(), resumeLessonId: null, expectedRevision: 1 })).not.toBeNull();
    expect(parseKqSchoolCannabinoidsProgress({ ...empty(), resumeLessonId: "cannabinoids-origins-1" })).toBeNull();
    expect(parseKqSchoolCannabinoidsProgress({ ...empty(), expectedRevision: 0 })).toBeNull();
  });
  it.each([
    { lessonIds: ["cannabinoids-fake-1"] }, { lessonIds: ["botany-anatomy-1"] }, { lessonIds: ["history-evidence-1"] }, { lessonIds: ["terpenes-vocabulary-1"] },
    { checkpointIds: ["cannabinoids-origins-1"] }, { activityIds: ["cannabinoids-origins-activity-3"] },
    { score: 10 }, { answer: "free text must not be persisted" }, { userId: "other" },
    { resumeLessonId: "cannabinoids-origins-1", expectedRevision: -1 }, { resumeLessonId: "cannabinoids-origins-1", expectedRevision: 1.5 },
    { lessonIds: Array(21).fill("cannabinoids-origins-1") }
  ])("rejects invalid, excessive or sensitive payload fields: %j", bad => {
    expect(parseKqSchoolCannabinoidsProgress({ ...empty(), ...bad })).toBeNull();
  });
});
