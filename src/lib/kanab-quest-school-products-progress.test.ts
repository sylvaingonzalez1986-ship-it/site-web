import { describe, expect, it } from "vitest";
import { KQ_SCHOOL_PRODUCTS_LESSON_IDS, KQ_SCHOOL_PRODUCTS_CHECKPOINT_IDS, KQ_SCHOOL_PRODUCTS_ACTIVITY_IDS, parseKqSchoolProductsProgress } from "./kanab-quest-school-products-progress";

const empty = () => ({ lessonIds: [], checkpointIds: [], activityIds: [] });
describe("products progress contract", () => {
  it("contains only the 20 lessons, 10 checkpoints and 20 real activity identities", () => {
    expect(KQ_SCHOOL_PRODUCTS_LESSON_IDS).toHaveLength(20);
    expect(KQ_SCHOOL_PRODUCTS_CHECKPOINT_IDS).toHaveLength(10);
    expect(KQ_SCHOOL_PRODUCTS_ACTIVITY_IDS).toHaveLength(20);
    expect(parseKqSchoolProductsProgress({ lessonIds: KQ_SCHOOL_PRODUCTS_LESSON_IDS, checkpointIds: KQ_SCHOOL_PRODUCTS_CHECKPOINT_IDS, activityIds: KQ_SCHOOL_PRODUCTS_ACTIVITY_IDS })).not.toBeNull();
    expect(parseKqSchoolProductsProgress({ ...empty(), lessonIds: ["profiles"] })).toBeNull();
  });
  it("requires a revision for resume changes and deduplicates completion batches", () => {
    expect(parseKqSchoolProductsProgress({ ...empty(), lessonIds: ["products-seeds-1", "products-seeds-1"], resumeLessonId: "products-seeds-2", expectedRevision: 0 }))
      .toEqual({ ...empty(), lessonIds: ["products-seeds-1"], resumeLessonId: "products-seeds-2", expectedRevision: 0 });
    expect(parseKqSchoolProductsProgress({ ...empty(), resumeLessonId: null, expectedRevision: 1 })).not.toBeNull();
    expect(parseKqSchoolProductsProgress({ ...empty(), resumeLessonId: "products-seeds-1" })).toBeNull();
    expect(parseKqSchoolProductsProgress({ ...empty(), expectedRevision: 0 })).toBeNull();
  });
  it.each([
    { lessonIds: ["products-fake-1"] }, { lessonIds: ["soil-physical-1"] }, { lessonIds: ["terpenes-vocabulary-1"] }, { lessonIds: ["cannabinoids-origins-1"] }, { lessonIds: ["cultivation-axes-1"] }, { lessonIds: ["health-observation-1"] }, { lessonIds: ["botany-anatomy-1"] }, { lessonIds: ["history-evidence-1"] },
    { checkpointIds: ["products-seeds-1"] }, { activityIds: ["products-seeds-activity-3"] },
    { score: 10 }, { answer: "free text must not be persisted" }, { userId: "other" },
    { resumeLessonId: "products-seeds-1", expectedRevision: -1 }, { resumeLessonId: "products-seeds-1", expectedRevision: 1.5 },
    { lessonIds: Array(21).fill("products-seeds-1") }
  ])("rejects invalid, excessive or sensitive payload fields: %j", bad => {
    expect(parseKqSchoolProductsProgress({ ...empty(), ...bad })).toBeNull();
  });
});
