import { CONTEST_AROMA_TAGS, CONTEST_CONSUMPTION_METHODS, CONTEST_SCORE_CRITERIA, type ContestReviewSubmissionInput, type ContestScoreCriterion } from "@/types/contest";
import type { ViewerContestReview } from "@/lib/contest-public-api";

export type ContestNotebookDraft = ContestReviewSubmissionInput & {
  comment: string;
  consumptionDetails: string;
  version: 1;
  ownerId: string;
  baseReviewVersion: string;
  savedAt: number;
  pageIndex: number;
  evaluatedCriteria: ContestScoreCriterion[];
};

export function contestReviewVersion(review: ViewerContestReview | null): string {
  return review ? `${review.id}:${review.updatedAt}:${review.status}` : "new";
}

export function contestDraftKey(ownerId: string, entryId: string): string {
  return `contest-notebook-draft:v1:${encodeURIComponent(ownerId)}:${encodeURIComponent(entryId)}`;
}

/** Storage is untrusted and a draft must never replace a newer server review. */
export function readContestDraft(raw: string | null, ownerId: string, entryId: string, review: ViewerContestReview | null, now = Date.now(), forComparisonOnly = false): ContestNotebookDraft | null {
  if (!raw || (!forComparisonOnly && review?.status === "approved")) return null;
  try {
    const draft = JSON.parse(raw) as ContestNotebookDraft;
    if (draft.version !== 1 || draft.ownerId !== ownerId || draft.entryId !== entryId || typeof draft.baseReviewVersion !== "string" || (!forComparisonOnly && draft.baseReviewVersion !== contestReviewVersion(review))) return null;
    if (!Number.isFinite(draft.savedAt) || draft.savedAt > now + 60_000 || now - draft.savedAt > 30 * 24 * 60 * 60 * 1000) return null;
    if (!draft.scores || CONTEST_SCORE_CRITERIA.some((criterion) => !Number.isInteger(draft.scores[criterion]) || draft.scores[criterion] < 1 || draft.scores[criterion] > 100)) return null;
    if (!Array.isArray(draft.evaluatedCriteria) || draft.evaluatedCriteria.some((criterion) => !CONTEST_SCORE_CRITERIA.includes(criterion))) return null;
    if (!CONTEST_CONSUMPTION_METHODS.includes(draft.consumptionMethod) || typeof draft.comment !== "string" || draft.comment.length > 2000 || typeof draft.consumptionDetails !== "string" || draft.consumptionDetails.length > 300) return null;
    if (!Array.isArray(draft.aromaTags) || draft.aromaTags.some((item) => !item || !CONTEST_AROMA_TAGS.includes(item.tag) || (item.customLabel !== undefined && (typeof item.customLabel !== "string" || item.customLabel.length > 80)))) return null;
    if (!Array.isArray(draft.terpeneGuesses) || draft.terpeneGuesses.some((item) => typeof item !== "string" || item.length > 80)) return null;
    if (!Number.isInteger(draft.pageIndex) || draft.pageIndex < 0 || draft.pageIndex > 4) return null;
    return { ...draft, evaluatedCriteria: [...new Set(draft.evaluatedCriteria)] };
  } catch {
    return null;
  }
}
