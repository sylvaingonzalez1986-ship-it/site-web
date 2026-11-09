import { describe, expect, it } from "vitest";
import type { ContestEntrySummary } from "@/types/contest";
import { getContestFlowerCategoryRank, sortContestFlowerRankingEntries } from "./contest-flower-ranking";

function flower(id: string, count: number, average: number, rank?: number): ContestEntrySummary {
  return {
    id, title: id,
    stats: { approvedReviewCount: count, averageScore: average },
    ...(rank === undefined ? {} : { ranking: { seasonCategoryRank: rank, isRankEligible: true } }),
  } as ContestEntrySummary;
}

describe("Flower ranking register", () => {
  it("keeps every flower beyond a top 12, including unrated flowers", () => {
    const entries = Array.from({ length: 16 }, (_, index) => flower(`flower-${index}`, 1, 80, index + 1));
    entries.push(flower("Sans avis", 0, 0));
    const originalIds = entries.map(entry => entry.id);
    const result = sortContestFlowerRankingEntries(entries);
    expect(result).toHaveLength(17);
    expect(new Set(result.map(entry => entry.id))).toEqual(new Set(originalIds));
    expect(result.at(-1)?.id).toBe("Sans avis");
    expect(entries.map(entry => entry.id)).toEqual(originalIds);
  });

  it("keeps official category ranks ahead of average scores across both notebooks", () => {
    const regular = { ...flower("Regular", 1, 94, 2), track: "regular" as const };
    const concours = { ...flower("Concours", 2, 82, 1), track: "concours" as const };
    expect(sortContestFlowerRankingEntries([regular, concours]).map(entry => entry.id)).toEqual(["Concours", "Regular"]);
    expect(getContestFlowerCategoryRank(regular)).toBe(2);
    expect(getContestFlowerCategoryRank(concours)).toBe(1);
  });

  it("does not invent ranks for unrated, unavailable or explicitly ineligible entries", () => {
    expect(getContestFlowerCategoryRank(flower("Sans avis", 0, 0, 1))).toBeNull();
    expect(getContestFlowerCategoryRank(flower("Absent", 2, 80))).toBeNull();
    expect(getContestFlowerCategoryRank(flower("Invalide", 2, 80, 0))).toBeNull();
    expect(getContestFlowerCategoryRank(flower("Invalide", 2, 80, NaN))).toBeNull();
    const ineligible = flower("Inéligible", 2, 80, 1);
    ineligible.ranking!.isRankEligible = false;
    expect(getContestFlowerCategoryRank(ineligible)).toBeNull();
  });

  it("keeps a real zero score reviewed and missing scores distinct from it", () => {
    const entries = [flower("Sans avis", 0, 99), flower("Inconnue", 1, NaN), flower("Zéro", 1, 0)];
    expect(sortContestFlowerRankingEntries(entries).map(entry => entry.id)).toEqual(["Zéro", "Inconnue", "Sans avis"]);
  });

  it("does not renumber a filtered notebook and preserves tied official ranks", () => {
    const entries = [flower("C", 1, 80, 7), flower("B", 2, 90, 3), flower("A", 2, 90, 3)];
    const ordered = sortContestFlowerRankingEntries(entries);
    expect(ordered.map(entry => entry.id)).toEqual(["A", "B", "C"]);
    expect(ordered.map(getContestFlowerCategoryRank)).toEqual([3, 3, 7]);
  });
});
