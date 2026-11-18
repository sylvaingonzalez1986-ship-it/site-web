import type { KqStaffSkills, KqStaffSnapshot, KqStaffState } from "./kanab-quest-staff-types";
import { getKqTeamReservedHours } from "./kanab-quest-team-day";

/** Fictional personal work allowance, shared by all manual farm activities. */
export const KQ_PLAYER_DAILY_HOURS = 12;
export const KQ_PLAYER_COUNTRYSIDE_COST_CENTS = 4_000;
export const KQ_WORK_EVENTS = ["kq:staff-updated", "kq:player-work-updated", "arena:progress-updated", "kq:equipment-updated", "kq:market-updated", "kq:commerce-updated", "kq:storage-updated", "kq:social-updated", "kq:treasury-updated", "kq:collection-updated"] as const;

export type KqPlayerWorkAvailability =
  | { status: "loading" | "unavailable" }
  | { status: "ready"; workday: ReturnType<typeof getKqPlayerWorkday>; serverNow: string; skills?: KqStaffSkills };

export function getKqPlayerWorkday(snapshot: Pick<KqStaffSnapshot, "state" | "calendar">): {
  day: number; dailyHours: number; usedHours: number; plannedHours?: number; remainingHours: number; nextDayAt: string;
} {
  const usedHours = snapshot.state.playerWorkDays?.[String(snapshot.calendar.day)]?.usedHours ?? 0;
  const plannedHours = getKqTeamReservedHours(snapshot.state.dayPlans, "player", snapshot.calendar.day);
  return { day: snapshot.calendar.day, dailyHours: KQ_PLAYER_DAILY_HOURS, usedHours, plannedHours,
    remainingHours: Math.max(0, KQ_PLAYER_DAILY_HOURS - usedHours - plannedHours), nextDayAt: snapshot.calendar.nextDayAt };
}

export function getKqPlayerSkills(state: KqStaffState): KqStaffSkills {
  return { culture: 0, communication: 0, sales: 0, administration: 0, ...state.playerSkills,
    processing: Math.max(state.playerProcessingXp ?? 0, state.playerSkills?.processing ?? 0) };
}
