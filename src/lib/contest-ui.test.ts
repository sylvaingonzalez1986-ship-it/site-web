import { describe, expect, it } from "vitest";
import { CONTEST_SCORE_CRITERIA } from "@/types/contest";
import { formatContestAverage, getContestReviewAverage } from "./contest-ui";
import { createContestReviewCursor, parseContestReviewCursor } from "./contest-review-pagination";

describe("public tasting scores", () => {
  const complete = CONTEST_SCORE_CRITERIA.map((criterion, index) => ({ criterion, score: 70 + index }));
  it("averages all ten criteria", () => {
    expect(getContestReviewAverage(complete)).toBe(74.5);
    expect(formatContestAverage(getContestReviewAverage(complete))).toBe("74,5");
  });
  it("never displays an absent, truncated, duplicate or invalid score as zero", () => {
    for (const scores of [[], complete.slice(0, 9), [...complete.slice(0, 9), complete[0]], complete.map((row) => ({ ...row, score: 0 }))]) {
      expect(getContestReviewAverage(scores)).toBeNull();
      expect(formatContestAverage(getContestReviewAverage(scores))).toBe("—");
    }
    expect(formatContestAverage(Number.NaN)).toBe("—");
  });
});

describe("review page cursors", () => {
  it("preserves timestamps and identifiers, including legacy reviews without moderation date", () => {
    const review = { id: "00000000-0000-4000-8000-000000000042", reviewedAt: null, createdAt: "2026-01-01T10:00:00.123456Z" };
    expect(parseContestReviewCursor(createContestReviewCursor(review))).toEqual({ publishedAt: review.createdAt, id: review.id });
  });
  it.each(["garbage", "null", "{}", JSON.stringify({ publishedAt: "invalid", id: "review" }), "x".repeat(513)])("rejects invalid cursor %s", (value) => {
    expect(() => parseContestReviewCursor(value)).toThrow("Curseur d’avis invalide");
  });
});
