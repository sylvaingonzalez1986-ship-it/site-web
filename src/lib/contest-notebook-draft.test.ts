import { describe, expect, it } from "vitest";
import { contestDraftKey, contestReviewVersion, readContestDraft, type ContestNotebookDraft } from "./contest-notebook-draft";
import { CONTEST_SCORE_CRITERIA } from "@/types/contest";
import type { ViewerContestReview } from "./contest-public-api";

const now = 1_800_000_000_000;
const draft: ContestNotebookDraft = {
  version: 1, ownerId: "alice", entryId: "flower", baseReviewVersion: "new", savedAt: now, pageIndex: 2,
  scores: Object.fromEntries(CONTEST_SCORE_CRITERIA.map((criterion) => [criterion, 70])) as ContestNotebookDraft["scores"],
  evaluatedCriteria: ["appearance"], consumptionMethod: "vaporizer", consumptionDetails: "", comment: "Mes impressions privées", aromaTags: [], terpeneGuesses: [],
};
const review = { id: "review", updatedAt: "2026-10-01T12:00:00Z", status: "pending" } as ViewerContestReview;

describe("private notebook drafts", () => {
  it("restores the matching owner, flower and assessed criteria", () => {
    expect(readContestDraft(JSON.stringify(draft), "alice", "flower", null, now)).toEqual(draft);
    expect(contestDraftKey("alice", "flower")).not.toBe(contestDraftKey("bob", "flower"));
  });
  it("never restores another owner, flower or outdated server revision", () => {
    const raw = JSON.stringify(draft);
    expect(readContestDraft(raw, "bob", "flower", null, now)).toBeNull();
    expect(readContestDraft(raw, "alice", "other", null, now)).toBeNull();
    expect(readContestDraft(raw, "alice", "flower", review, now)).toBeNull();
    const edit = { ...draft, baseReviewVersion: contestReviewVersion(review) };
    expect(readContestDraft(JSON.stringify(edit), "alice", "flower", review, now)).toEqual(edit);
    expect(readContestDraft(JSON.stringify(edit), "alice", "flower", { ...review, updatedAt: "2026-10-02T00:00:00Z" }, now)).toBeNull();
    expect(readContestDraft(JSON.stringify(edit), "alice", "flower", { ...review, status: "approved" }, now)).toBeNull();
    expect(readContestDraft(JSON.stringify(edit), "alice", "flower", { ...review, status: "approved" }, now, true)).toEqual(edit);
    expect(readContestDraft(JSON.stringify(edit), "bob", "flower", review, now, true)).toBeNull();
  });
  it("ignores broken storage, invalid scores and expired private notes", () => {
    for (const raw of ["{broken", "null", JSON.stringify({ ...draft, scores: { ...draft.scores, flavor: 101 } }), JSON.stringify({ ...draft, pageIndex: 100 }), JSON.stringify({ ...draft, evaluatedCriteria: ["unknown"] })]) {
      expect(readContestDraft(raw, "alice", "flower", null, now)).toBeNull();
    }
    expect(readContestDraft(JSON.stringify(draft), "alice", "flower", null, now + 31 * 24 * 60 * 60 * 1000)).toBeNull();
  });
});
