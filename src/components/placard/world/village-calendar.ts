import { getKqBusinessClock, KQ_GAME_DAY_MS } from "@/lib/kanab-quest-business";

const MINUTES_PER_DAY = 24 * 60;
export const VILLAGE_GAME_MINUTE_MS = KQ_GAME_DAY_MS / MINUTES_PER_DAY;

export const VILLAGE_PHASE_START = { dawn: 300, day: 480, dusk: 1080, night: 1260 } as const;

export type VillageCalendar = {
  day: number;
  month: number;
  dayOfMonth: number;
  minuteOfDay: number;
  progress: number;
  season: "spring" | "summer" | "autumn" | "winter";
  phase: keyof typeof VILLAGE_PHASE_START;
};

function describeDay(day: number, month: number, dayOfMonth: number, elapsedTodayMs: number): VillageCalendar {
  // Months 1–3 are spring, 4–6 summer, 7–9 autumn and 10–12 winter, repeating each year.
  const seasons = ["spring", "summer", "autumn", "winter"] as const;
  const season = seasons[Math.floor(((month - 1) % 12) / 3)];
  const progress = elapsedTodayMs / KQ_GAME_DAY_MS;
  const minuteOfDay = Math.floor(elapsedTodayMs / VILLAGE_GAME_MINUTE_MS);
  const { dawn, day: daylight, dusk, night } = VILLAGE_PHASE_START;
  const phase = minuteOfDay < dawn || minuteOfDay >= night ? "night"
    : minuteOfDay < daylight ? "dawn" : minuteOfDay < dusk ? "day" : "dusk";
  return { day, month, dayOfMonth, minuteOfDay, progress, season, phase };
}

export function getVillageCalendar(startedAt: string, nowMs: number): VillageCalendar | null {
  const origin = Date.parse(startedAt);
  if (!Number.isFinite(origin) || !Number.isFinite(nowMs)) return null;
  const { day, month, dayOfMonth } = getKqBusinessClock(startedAt, nowMs);
  return describeDay(day, month, dayOfMonth, Math.max(0, nowMs - origin) % KQ_GAME_DAY_MS);
}

export function getVillageCalendarPreview(search: string): VillageCalendar | null {
  const params = new URLSearchParams(search);
  const rawDay = params.get("villageDay");
  const rawMinute = params.get("villageMinute");
  if (!rawDay || !rawMinute || !/^\d+$/.test(rawDay) || !/^\d+$/.test(rawMinute)) return null;
  const day = Number(rawDay);
  const minute = Number(rawMinute);
  const simulatedTime = ((day - 1) * MINUTES_PER_DAY + minute) * VILLAGE_GAME_MINUTE_MS;
  if (!Number.isSafeInteger(day) || day < 1 || minute >= MINUTES_PER_DAY || simulatedTime > 8.64e15 - KQ_GAME_DAY_MS) return null;
  return getVillageCalendar("1970-01-01T00:00:00.000Z", simulatedTime);
}
