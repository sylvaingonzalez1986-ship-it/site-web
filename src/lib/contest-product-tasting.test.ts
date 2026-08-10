import { describe, expect, it } from "vitest";
import { selectContestProductTastingEntry } from "@/lib/contest-product-tasting";
import type { ContestEntrySummary } from "@/types/contest";

function entry(
  id: string,
  updatedAt: string,
  season: { isActive: boolean; isArchived: boolean },
): ContestEntrySummary {
  return { id, updatedAt, season } as ContestEntrySummary;
}

describe("selectContestProductTastingEntry", () => {
  it("prefers the active non-archived season over a newer inactive lot", () => {
    const active = entry("active", "2026-01-01T00:00:00.000Z", { isActive: true, isArchived: false });
    const newer = entry("newer", "2026-07-01T00:00:00.000Z", { isActive: false, isArchived: false });

    expect(selectContestProductTastingEntry([newer, active])?.id).toBe("active");
  });

  it("uses the most recently updated lot when no season is active", () => {
    const older = entry("older", "2025-01-01T00:00:00.000Z", { isActive: false, isArchived: true });
    const newer = entry("newer", "2026-01-01T00:00:00.000Z", { isActive: false, isArchived: false });

    expect(selectContestProductTastingEntry([older, newer])?.id).toBe("newer");
  });

  it("returns null when the product has no published tasting lot", () => {
    expect(selectContestProductTastingEntry([])).toBeNull();
  });
});
