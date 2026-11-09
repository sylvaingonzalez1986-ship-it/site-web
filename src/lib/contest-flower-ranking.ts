import type { ContestEntrySummary } from "@/types/contest";

export function getContestFlowerCategoryRank(entry: ContestEntrySummary): number | null {
  const rank = entry.ranking?.seasonCategoryRank;
  return entry.stats.approvedReviewCount > 0
    && entry.ranking?.isRankEligible !== false
    && typeof rank === "number" && Number.isInteger(rank) && rank > 0
    ? rank
    : null;
}

/** Keep every published flower; the server remains authoritative for ranks. */
export function sortContestFlowerRankingEntries(entries: ContestEntrySummary[]): ContestEntrySummary[] {
  return [...entries].sort((a, b) => {
    const aRank = getContestFlowerCategoryRank(a);
    const bRank = getContestFlowerCategoryRank(b);
    if (aRank !== null || bRank !== null) {
      if (aRank === null) return 1;
      if (bRank === null) return -1;
      if (aRank !== bRank) return aRank - bRank;
    }

    const aReviewed = a.stats.approvedReviewCount > 0;
    const bReviewed = b.stats.approvedReviewCount > 0;
    if (aReviewed !== bReviewed) return aReviewed ? -1 : 1;
    if (aReviewed && bReviewed) {
      const aScore = Number.isFinite(a.stats.averageScore) ? a.stats.averageScore : null;
      const bScore = Number.isFinite(b.stats.averageScore) ? b.stats.averageScore : null;
      if (aScore !== bScore) {
        if (aScore === null) return 1;
        if (bScore === null) return -1;
        return bScore - aScore;
      }
      const countDelta = b.stats.approvedReviewCount - a.stats.approvedReviewCount;
      if (countDelta) return countDelta;
    }

    return a.title.localeCompare(b.title, "fr") || a.id.localeCompare(b.id);
  });
}
