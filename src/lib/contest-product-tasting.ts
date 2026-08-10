import type { ContestEntrySummary } from "@/types/contest";

export function selectContestProductTastingEntry(
  entries: ContestEntrySummary[],
): ContestEntrySummary | null {
  return [...entries].sort((left, right) => {
    const leftActive = left.season?.isActive && !left.season.isArchived ? 1 : 0;
    const rightActive = right.season?.isActive && !right.season.isArchived ? 1 : 0;
    if (leftActive !== rightActive) {
      return rightActive - leftActive;
    }
    return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  })[0] ?? null;
}
