import type { KqStaffSkills, KqStaffSnapshot, KqStaffState } from "./kanab-quest-staff-types";

/** Fictional personal work allowance, shared by all manual farm activities. */
export const KQ_PLAYER_DAILY_HOURS = 12;
export const KQ_PLAYER_COUNTRYSIDE_COST_CENTS = 4_000;

export type KqPlayerWorkAvailability =
  | { status: "loading" | "unavailable" }
  | { status: "ready"; workday: ReturnType<typeof getKqPlayerWorkday>; serverNow: string; skills?: KqStaffSkills };

export function getKqPlayerWorkday(snapshot: Pick<KqStaffSnapshot, "state" | "calendar">) {
  const usedHours = snapshot.state.playerWorkDays?.[String(snapshot.calendar.day)]?.usedHours ?? 0;
  return { day: snapshot.calendar.day, dailyHours: KQ_PLAYER_DAILY_HOURS, usedHours,
    remainingHours: Math.max(0, KQ_PLAYER_DAILY_HOURS - usedHours), nextDayAt: snapshot.calendar.nextDayAt };
}

export function getKqPlayerSkills(state: KqStaffState): KqStaffSkills {
  return { culture: 0, communication: 0, sales: 0, administration: 0, ...state.playerSkills,
    processing: Math.max(state.playerProcessingXp ?? 0, state.playerSkills?.processing ?? 0) };
}
