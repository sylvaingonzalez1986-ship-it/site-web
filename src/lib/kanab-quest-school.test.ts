import { describe, expect, it } from "vitest";
import { getKqSchoolRewardTarget, parseKqSchoolProgress, parseKqSchoolSubmission } from "./kanab-quest-school";

const submission = () => ({ requestKey: "12345678-1234-4123-8123-123456789abc", quizId: "plant", contentVersion: "2026-11-11.1",
  answers: Array.from({ length: 10 }, (_, index) => ({ questionId: `plant-q${String(index + 1).padStart(2, "0")}`, optionId: "a" })) });
describe("school protocol", () => {
  it("canonicalizes answer ordering without modifying the browser draft", () => {
    const draft = submission(); draft.answers.reverse();
    const parsed = parseKqSchoolSubmission(draft);
    expect(parsed?.answers[0].questionId).toBe("plant-q01");
    expect(draft.answers[0].questionId).toBe("plant-q10");
  });
  it.each(["score", "gainCents", "userId", "budgetCents", "rewardId"])("rejects the untrusted %s field", key => {
    expect(parseKqSchoolSubmission({ ...submission(), [key]: 10000 })).toBeNull();
  });
  it("rejects missing, duplicate, excessive and malformed answers", () => {
    const valid = submission();
    for (const answers of [valid.answers.slice(1), [...valid.answers, valid.answers[0]], valid.answers.map(() => valid.answers[0]),
      [...valid.answers.slice(1), { questionId: null, optionId: "a" }], [...valid.answers.slice(1), { ...valid.answers[0], correct: true }]]) {
      expect(parseKqSchoolSubmission({ ...valid, answers })).toBeNull();
    }
    expect(parseKqSchoolSubmission({ ...valid, requestKey: "random" })).toBeNull();
    expect(parseKqSchoolSubmission({ ...valid, quizId: "unknown" })).toBeNull();
    expect(parseKqSchoolSubmission({ ...valid, contentVersion: "" })).toBeNull();
  });
  it("accepts only a bounded selector with the matching course prefix", () => {
    const selectionId = `h1.12345678-1234-4123-8123-123456789abc.${"a".repeat(64)}`;
    expect(parseKqSchoolSubmission({ ...submission(), quizId: "history", selectionId })?.selectionId).toBe(selectionId);
    expect(parseKqSchoolSubmission({ ...submission(), selectionId })).toBeNull();
    const botany = selectionId.replace("h1.", "b1.");
    expect(parseKqSchoolSubmission({ ...submission(), selectionId: botany })?.selectionId).toBe(botany);
    expect(parseKqSchoolSubmission({ ...submission(), quizId: "history", selectionId: botany })).toBeNull();
    expect(parseKqSchoolSubmission({ ...submission(), quizId: "molecules", selectionId: botany })).toBeNull();
    const terpenes = selectionId.replace("h1.", "t1.");
    expect(parseKqSchoolSubmission({ ...submission(), quizId: "molecules", selectionId: terpenes })?.selectionId).toBe(terpenes);
    for (const quizId of ["plant", "history", "profiles"]) expect(parseKqSchoolSubmission({ ...submission(), quizId, selectionId: terpenes })).toBeNull();
    const cannabinoids = selectionId.replace("h1.", "c1.");
    expect(parseKqSchoolSubmission({ ...submission(), quizId: "evidence", selectionId: cannabinoids })?.selectionId).toBe(cannabinoids);
    for (const quizId of ["plant", "history", "molecules", "profiles"]) expect(parseKqSchoolSubmission({ ...submission(), quizId, selectionId: cannabinoids })).toBeNull();
    const harvest = selectionId.replace("h1.", "r1.");
    expect(parseKqSchoolSubmission({ ...submission(), quizId: "prevention", selectionId: harvest })?.selectionId).toBe(harvest);
    for (const quizId of ["plant", "history", "molecules", "evidence", "genetics", "biodiversity", "uses", "profiles", "law"]) expect(parseKqSchoolSubmission({ ...submission(), quizId, selectionId: harvest })).toBeNull();
    const products = selectionId.replace("h1.", "v1.");
    expect(parseKqSchoolSubmission({ ...submission(), quizId: "profiles", selectionId: products })?.selectionId).toBe(products);
    for (const quizId of ["plant", "history", "molecules", "evidence", "genetics", "biodiversity", "uses", "law", "prevention"]) expect(parseKqSchoolSubmission({ ...submission(), quizId, selectionId: products })).toBeNull();
    const soil = selectionId.replace("h1.", "s1.");
    expect(parseKqSchoolSubmission({ ...submission(), quizId: "uses", selectionId: soil })?.selectionId).toBe(soil);
    for (const quizId of ["plant", "history", "molecules", "evidence", "genetics", "biodiversity", "profiles"]) expect(parseKqSchoolSubmission({ ...submission(), quizId, selectionId: soil })).toBeNull();
    const health = selectionId.replace("h1.", "p1.");
    expect(parseKqSchoolSubmission({ ...submission(), quizId: "biodiversity", selectionId: health })?.selectionId).toBe(health);
    for (const quizId of ["plant", "history", "molecules", "evidence", "genetics", "profiles"]) expect(parseKqSchoolSubmission({ ...submission(), quizId, selectionId: health })).toBeNull();
    const cultivation = selectionId.replace("h1.", "u1.");
    expect(parseKqSchoolSubmission({ ...submission(), quizId: "genetics", selectionId: cultivation })?.selectionId).toBe(cultivation);
    for (const quizId of ["plant", "history", "molecules", "evidence", "profiles"]) expect(parseKqSchoolSubmission({ ...submission(), quizId, selectionId: cultivation })).toBeNull();
    expect(parseKqSchoolSubmission({ ...submission(), quizId: "history", selectionId: "invented" })).toBeNull();
    expect(parseKqSchoolSubmission({ ...submission(), quizId: "history", selectionId: null })).toBeNull();
  });
  it("validates and deduplicates a bounded batch of real lessons and workshops", () => {
    expect(parseKqSchoolProgress({ lessonIds: ["uses", "plant", "uses"], workshopIds: ["timeline-history", "timeline-history"] }))
      .toEqual({ lessonIds: ["plant", "uses"], workshopIds: ["timeline-history"] });
    expect(parseKqSchoolProgress({ lessonIds: ["fake"], workshopIds: [] })).toBeNull();
    expect(parseKqSchoolProgress({ lessonIds: [], workshopIds: ["fake"] })).toBeNull();
    expect(parseKqSchoolProgress({ lessonIds: [], workshopIds: [], paidCents: 1 })).toBeNull();
    expect(parseKqSchoolProgress({ lessonIds: Array(11).fill("plant"), workshopIds: [] })).toBeNull();
  });
  it("applies threshold and floors cent amounts", () => {
    expect([0, 6, 7, 9, 10].map(score => getKqSchoolRewardTarget(score, 1001))).toEqual([0, 0, 700, 900, 1001]);
    expect(() => getKqSchoolRewardTarget(11, 1000)).toThrow();
    expect(() => getKqSchoolRewardTarget(7.1, 1000)).toThrow();
    expect(() => getKqSchoolRewardTarget(7, -1)).toThrow();
  });
});
