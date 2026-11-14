import { describe, expect, it } from "vitest";
import { KQ_SCHOOL_SOIL_LESSON_IDS, KQ_SCHOOL_SOIL_CHECKPOINT_IDS, KQ_SCHOOL_SOIL_ACTIVITY_IDS, parseKqSchoolSoilProgress } from "./kanab-quest-school-soil-progress";

const empty = () => ({ lessonIds: [], checkpointIds: [], activityIds: [] });
describe("soil progress contract", () => {
  it("contains only the 20 lessons, 10 checkpoints and 20 real activity identities", () => {
    expect(KQ_SCHOOL_SOIL_LESSON_IDS).toHaveLength(20);
    expect(KQ_SCHOOL_SOIL_CHECKPOINT_IDS).toHaveLength(10);
    expect(KQ_SCHOOL_SOIL_ACTIVITY_IDS).toHaveLength(20);
    expect(parseKqSchoolSoilProgress({ lessonIds: KQ_SCHOOL_SOIL_LESSON_IDS, checkpointIds: KQ_SCHOOL_SOIL_CHECKPOINT_IDS, activityIds: KQ_SCHOOL_SOIL_ACTIVITY_IDS })).not.toBeNull();
    expect(parseKqSchoolSoilProgress({ ...empty(), lessonIds: ["uses"] })).toBeNull();
  });
  it("requires a revision for resume changes and deduplicates completion batches", () => {
    expect(parseKqSchoolSoilProgress({ ...empty(), lessonIds: ["soil-physical-1", "soil-physical-1"], resumeLessonId: "soil-physical-2", expectedRevision: 0 }))
      .toEqual({ ...empty(), lessonIds: ["soil-physical-1"], resumeLessonId: "soil-physical-2", expectedRevision: 0 });
    expect(parseKqSchoolSoilProgress({ ...empty(), resumeLessonId: null, expectedRevision: 1 })).not.toBeNull();
    expect(parseKqSchoolSoilProgress({ ...empty(), resumeLessonId: "soil-physical-1" })).toBeNull();
    expect(parseKqSchoolSoilProgress({ ...empty(), expectedRevision: 0 })).toBeNull();
  });
  it.each([
    { lessonIds: ["soil-fake-1"] }, { lessonIds: ["terpenes-vocabulary-1"] }, { lessonIds: ["cannabinoids-origins-1"] }, { lessonIds: ["cultivation-axes-1"] }, { lessonIds: ["health-observation-1"] }, { lessonIds: ["botany-anatomy-1"] }, { lessonIds: ["history-evidence-1"] },
    { checkpointIds: ["soil-physical-1"] }, { activityIds: ["soil-physical-activity-3"] },
    { score: 10 }, { answer: "free text must not be persisted" }, { userId: "other" },
    { resumeLessonId: "soil-physical-1", expectedRevision: -1 }, { resumeLessonId: "soil-physical-1", expectedRevision: 1.5 },
    { lessonIds: Array(21).fill("soil-physical-1") }
  ])("rejects invalid, excessive or sensitive payload fields: %j", bad => {
    expect(parseKqSchoolSoilProgress({ ...empty(), ...bad })).toBeNull();
  });
});
