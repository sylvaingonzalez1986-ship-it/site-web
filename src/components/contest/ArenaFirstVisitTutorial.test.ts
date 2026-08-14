import { describe, expect, it, vi } from "vitest";
import {
  ARENA_TUTORIAL_STEPS,
  ARENA_TUTORIAL_STORAGE_KEY,
  markArenaTutorialSeen,
  shouldShowArenaTutorial,
} from "@/components/contest/ArenaFirstVisitTutorial";

describe("ArenaFirstVisitTutorial", () => {
  it("opens on the first visit and stays dismissed afterwards", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    };

    expect(shouldShowArenaTutorial(storage)).toBe(true);
    markArenaTutorialSeen(storage);
    expect(values.get(ARENA_TUTORIAL_STORAGE_KEY)).toBe("seen");
    expect(shouldShowArenaTutorial(storage)).toBe(false);
  });

  it("remains usable when private storage is unavailable", () => {
    const storage = {
      getItem: vi.fn(() => { throw new Error("blocked"); }),
      setItem: vi.fn(() => { throw new Error("blocked"); }),
    };

    expect(shouldShowArenaTutorial(storage)).toBe(true);
    expect(() => markArenaTutorialSeen(storage)).not.toThrow();
  });

  it("keeps the Arena journey limited to the Notebook and Placard", () => {
    expect(ARENA_TUTORIAL_STEPS.map((step) => step.id)).toEqual(["carnet", "placard"]);
    expect(ARENA_TUTORIAL_STEPS.map((step) => step.href)).toEqual([
      "/arene/carnet/regular",
      "/arene/placard",
    ]);
    expect(ARENA_TUTORIAL_STEPS[0]?.features).toHaveLength(3);
    expect(ARENA_TUTORIAL_STEPS[1]?.features).toHaveLength(4);
  });
});
