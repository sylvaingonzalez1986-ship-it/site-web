import { describe, expect, it } from "vitest";
import { KQ_SCHOOL_HARVEST_LESSON_IDS, KQ_SCHOOL_HARVEST_CHECKPOINT_IDS, KQ_SCHOOL_HARVEST_ACTIVITY_IDS, parseKqSchoolHarvestProgress } from "./kanab-quest-school-harvest-progress";

const empty = () => ({ lessonIds: [], checkpointIds: [], activityIds: [] });
describe("harvest progress contract", () => {
  it("contains only the 18 lessons, 9 checkpoints and 18 real activity identities", () => {
    expect(KQ_SCHOOL_HARVEST_LESSON_IDS).toHaveLength(18);
    expect(KQ_SCHOOL_HARVEST_CHECKPOINT_IDS).toHaveLength(9);
    expect(KQ_SCHOOL_HARVEST_ACTIVITY_IDS).toHaveLength(18);
    expect(parseKqSchoolHarvestProgress({ lessonIds: KQ_SCHOOL_HARVEST_LESSON_IDS, checkpointIds: KQ_SCHOOL_HARVEST_CHECKPOINT_IDS, activityIds: KQ_SCHOOL_HARVEST_ACTIVITY_IDS })).not.toBeNull();
    expect(parseKqSchoolHarvestProgress({ ...empty(), lessonIds: ["prevention"] })).toBeNull();
  });
  it("requires a revision for resume changes and deduplicates completion batches", () => {
    expect(parseKqSchoolHarvestProgress({ ...empty(), lessonIds: ["harvest-outcomes-1", "harvest-outcomes-1"], resumeLessonId: "harvest-outcomes-2", expectedRevision: 0 }))
      .toEqual({ ...empty(), lessonIds: ["harvest-outcomes-1"], resumeLessonId: "harvest-outcomes-2", expectedRevision: 0 });
    expect(parseKqSchoolHarvestProgress({ ...empty(), resumeLessonId: null, expectedRevision: 1 })).not.toBeNull();
    expect(parseKqSchoolHarvestProgress({ ...empty(), resumeLessonId: "harvest-outcomes-1" })).toBeNull();
    expect(parseKqSchoolHarvestProgress({ ...empty(), expectedRevision: 0 })).toBeNull();
  });
  it.each([
    { lessonIds: ["harvest-fake-1"] }, { lessonIds: ["products-seeds-1"] }, { lessonIds: ["soil-physical-1"] }, { lessonIds: ["terpenes-vocabulary-1"] }, { lessonIds: ["cannabinoids-origins-1"] }, { lessonIds: ["cultivation-axes-1"] }, { lessonIds: ["health-observation-1"] }, { lessonIds: ["botany-anatomy-1"] }, { lessonIds: ["history-evidence-1"] },
    { checkpointIds: ["harvest-outcomes-1"] }, { activityIds: ["harvest-outcomes-activity-3"] },
    { score: 10 }, { answer: "free text must not be persisted" }, { userId: "other" },
    { resumeLessonId: "harvest-outcomes-1", expectedRevision: -1 }, { resumeLessonId: "harvest-outcomes-1", expectedRevision: 1.5 },
    { lessonIds: Array(19).fill("harvest-outcomes-1") }
  ])("rejects invalid, excessive or sensitive payload fields: %j", bad => {
    expect(parseKqSchoolHarvestProgress({ ...empty(), ...bad })).toBeNull();
  });
});
