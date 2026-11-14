import { describe, expect, it } from "vitest";
import { KQ_SCHOOL_BOTANY_LESSON_IDS, KQ_SCHOOL_BOTANY_CHECKPOINT_IDS, KQ_SCHOOL_BOTANY_ACTIVITY_IDS, parseKqSchoolBotanyProgress } from "./kanab-quest-school-botany-progress";

const empty = () => ({ lessonIds: [], checkpointIds: [], activityIds: [] });
describe("botany progress contract", () => {
  it("contains only the 16 lessons, 8 checkpoints and 16 real activity identities", () => {
    expect(KQ_SCHOOL_BOTANY_LESSON_IDS).toHaveLength(16);
    expect(KQ_SCHOOL_BOTANY_CHECKPOINT_IDS).toHaveLength(8);
    expect(KQ_SCHOOL_BOTANY_ACTIVITY_IDS).toHaveLength(16);
    expect(parseKqSchoolBotanyProgress({ lessonIds: KQ_SCHOOL_BOTANY_LESSON_IDS, checkpointIds: KQ_SCHOOL_BOTANY_CHECKPOINT_IDS, activityIds: KQ_SCHOOL_BOTANY_ACTIVITY_IDS })).not.toBeNull();
    expect(parseKqSchoolBotanyProgress({ ...empty(), lessonIds: ["plant"] })).toBeNull();
  });
  it("requires a revision for resume changes and deduplicates completion batches", () => {
    expect(parseKqSchoolBotanyProgress({ ...empty(), lessonIds: ["botany-anatomy-1", "botany-anatomy-1"], resumeLessonId: "botany-anatomy-2", expectedRevision: 0 }))
      .toEqual({ ...empty(), lessonIds: ["botany-anatomy-1"], resumeLessonId: "botany-anatomy-2", expectedRevision: 0 });
    expect(parseKqSchoolBotanyProgress({ ...empty(), resumeLessonId: null, expectedRevision: 1 })).not.toBeNull();
    expect(parseKqSchoolBotanyProgress({ ...empty(), resumeLessonId: "botany-anatomy-1" })).toBeNull();
    expect(parseKqSchoolBotanyProgress({ ...empty(), expectedRevision: 0 })).toBeNull();
  });
  it.each([
    { lessonIds: ["botany-fake-1"] }, { checkpointIds: ["botany-anatomy-1"] }, { activityIds: ["botany-anatomy-activity-3"] },
    { score: 10 }, { answer: "free text must not be persisted" }, { userId: "other" },
    { resumeLessonId: "botany-anatomy-1", expectedRevision: -1 }, { resumeLessonId: "botany-anatomy-1", expectedRevision: 1.5 },
    { lessonIds: Array(17).fill("botany-anatomy-1") }
  ])("rejects invalid, excessive or sensitive payload fields: %j", bad => {
    expect(parseKqSchoolBotanyProgress({ ...empty(), ...bad })).toBeNull();
  });
});
