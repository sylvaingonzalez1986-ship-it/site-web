import { describe, expect, it } from "vitest";
import { KQ_GAME_DAY_MS } from "@/lib/kanab-quest-business";
import { getVillageCalendar, getVillageCalendarPreview } from "./village-calendar";

const startedAt = "2026-10-10T12:00:00.000Z";
const origin = Date.parse(startedAt);

describe("village calendar", () => {
  it("uses the saved origin and rolls over at four hours and thirty days", () => {
    expect(getVillageCalendar(startedAt, origin - 1)).toMatchObject({ day: 1, month: 1, dayOfMonth: 1, minuteOfDay: 0, progress: 0 });
    expect(getVillageCalendar(startedAt, origin + 30 * KQ_GAME_DAY_MS - 1)).toMatchObject({ day: 30, month: 1, dayOfMonth: 30, minuteOfDay: 1439 });
    expect(getVillageCalendar(startedAt, origin + 30 * KQ_GAME_DAY_MS)).toMatchObject({ day: 31, month: 2, dayOfMonth: 1, minuteOfDay: 0, progress: 0 });
  });

  it.each([[1, "spring"], [3, "spring"], [4, "summer"], [7, "autumn"], [10, "winter"], [13, "spring"]])("uses month %i for %s", (month, season) => {
    expect(getVillageCalendar(startedAt, origin + (month - 1) * 30 * KQ_GAME_DAY_MS)?.season).toBe(season);
  });

  it.each([[0, "night"], [299, "night"], [300, "dawn"], [479, "dawn"], [480, "day"], [1079, "day"], [1080, "dusk"], [1259, "dusk"], [1260, "night"], [1439, "night"]])("uses minute %i for %s", (minute, phase) => {
    const current = getVillageCalendar(startedAt, origin + minute * 10_000);
    expect(current).toMatchObject({ minuteOfDay: minute, phase });
  });

  it("keeps missing or invalid clocks unknown", () => {
    expect(getVillageCalendar("", origin)).toBeNull();
    expect(getVillageCalendar(startedAt, NaN)).toBeNull();
  });

  it("limits the development preview to valid whole days and minutes", () => {
    expect(getVillageCalendarPreview("?villageDay=91&villageMinute=720")).toMatchObject({ day: 91, month: 4, dayOfMonth: 1, minuteOfDay: 720, progress: 0.5, season: "summer" });
    for (const invalid of ["", "?villageDay=1", "?villageDay=0&villageMinute=0", "?villageDay=2&villageMinute=1440", "?villageDay=2&villageMinute=1.1"])
      expect(getVillageCalendarPreview(invalid)).toBeNull();
  });
});
