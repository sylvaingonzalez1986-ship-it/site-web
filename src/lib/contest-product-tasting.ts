import type { ContestEntrySummary } from "@/types/contest";

export function getProductTastingNotebookHref(
  entry: Pick<ContestEntrySummary, "id" | "track" | "season">,
  editNotes = false,
): string {
  const params = new URLSearchParams({ entry: entry.id });
  if (entry.season?.code) params.set("season", entry.season.code);
  if (editNotes) params.set("edit", "notes");
  return `/arene/carnet/${entry.track}?${params.toString()}`;
}

function timestamp(value: string | undefined): number {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function selectContestProductTastingEntry(
  entries: ContestEntrySummary[],
): ContestEntrySummary | null {
  return [...entries].sort((left, right) => {
    const leftActive = left.season?.isActive && !left.season.isArchived ? 1 : 0;
    const rightActive = right.season?.isActive && !right.season.isArchived ? 1 : 0;
    if (leftActive !== rightActive) {
      return rightActive - leftActive;
    }
    // Editorial changes to an archive must not make it the current tasting lot.
    return (right.season?.year ?? 0) - (left.season?.year ?? 0)
      || timestamp(right.season?.harvestEnd ?? right.season?.harvestStart) - timestamp(left.season?.harvestEnd ?? left.season?.harvestStart)
      || timestamp(right.season?.createdAt) - timestamp(left.season?.createdAt)
      || timestamp(right.createdAt) - timestamp(left.createdAt)
      || left.id.localeCompare(right.id);
  })[0] ?? null;
}
