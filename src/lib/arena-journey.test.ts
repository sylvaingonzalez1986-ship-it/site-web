import { describe, expect, it } from "vitest";
import { advanceArenaJourney, ARENA_JOURNEY_STEPS, arenaJourneyStorageKey, NEW_ARENA_JOURNEY, parseArenaJourneyProgress } from "./arena-journey";

describe("guided arena journey", () => {
  it("takes the player from the notebook to cards, cultivation and missions", () => {
    let progress = advanceArenaJourney(NEW_ARENA_JOURNEY, "start");
    expect(ARENA_JOURNEY_STEPS[progress.step].href).toBe("/arene/carnet/regular");
    progress = advanceArenaJourney(progress, "next");
    expect(ARENA_JOURNEY_STEPS[progress.step].target).toContain("collection");
    progress = advanceArenaJourney(progress, "next");
    expect(ARENA_JOURNEY_STEPS[progress.step].id).toBe("shop");
    progress = advanceArenaJourney(progress, "next");
    expect(ARENA_JOURNEY_STEPS[progress.step].href).toContain("catalog=equipment");
    expect(ARENA_JOURNEY_STEPS[progress.step].highlights?.join(" ")).toContain("qualité maximale");
    progress = advanceArenaJourney(progress, "next");
    expect(ARENA_JOURNEY_STEPS[progress.step].id).toBe("installation");
    progress = advanceArenaJourney(progress, "next");
    expect(ARENA_JOURNEY_STEPS[progress.step].id).toBe("culture");
    progress = advanceArenaJourney(progress, "next");
    expect(ARENA_JOURNEY_STEPS[progress.step].id).toBe("jury");
    progress = advanceArenaJourney(progress, "next");
    expect(ARENA_JOURNEY_STEPS[progress.step].id).toBe("market");
    progress = advanceArenaJourney(progress, "next");
    expect(ARENA_JOURNEY_STEPS[progress.step].href).toBe("/arene/placard?view=missions");
    expect(advanceArenaJourney(progress, "next")).toEqual({ step: 9, status: "completed" });
  });
  it("keeps skipped/completed journeys closed until an explicit replay", () => {
    for (const status of ["skipped", "completed"] as const) {
      const progress = { step: 2, status };
      expect(advanceArenaJourney(progress, "next")).toEqual(progress);
      expect(advanceArenaJourney(progress, "previous")).toEqual(progress);
      expect(advanceArenaJourney(progress, "restart")).toEqual({ step: 0, status: "active" });
    }
    expect(advanceArenaJourney({ step: 2, status: "active" }, "skip")).toEqual({ step: 2, status: "skipped" });
    expect(advanceArenaJourney(NEW_ARENA_JOURNEY, "previous").step).toBe(0);
  });
  it("validates persisted progress and isolates browser copies per account", () => {
    for (const input of [null, [], {}, { step: -1, status: "active" }, { step: 10, status: "active" }, { step: 1.5, status: "active" }, { step: "1", status: "active" }, { step: 1, status: "unknown" }]) {
      expect(parseArenaJourneyProgress(input)).toBeNull();
    }
    expect(parseArenaJourneyProgress({ step: 1, status: "active", userId: "forged" })).toEqual({ step: 1, status: "active" });
    expect(arenaJourneyStorageKey("alice")).not.toBe(arenaJourneyStorageKey("bob"));
  });
});
