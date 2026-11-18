import { getKqPlayerWorkday } from "./kanab-quest-player-work";
import { getKqStaffCapacity } from "./kanab-quest-staff";
import type { KqStaffSnapshot } from "./kanab-quest-staff-types";
export { getKqTeamWorkEntries, getKqWorkerProcessingEnd } from "./kanab-quest-team-work";

const round = (hours: number) => Math.round(hours * 100) / 100;

export function getKqTeamDayBudget(snapshot: KqStaffSnapshot, assigneeId: string) {
  const employee = snapshot.state.employees.find(row => row.id === assigneeId);
  const capacity = employee && getKqStaffCapacity(employee, snapshot.calendar, snapshot.state.dayPlans);
  const player = getKqPlayerWorkday(snapshot);
  const totalHours = assigneeId === "player" ? player.dailyHours : capacity ? capacity.baseHours + capacity.extraHours : 0;
  const booked = assigneeId === "player" ? player.usedHours : capacity?.usedHours ?? 0;
  const planned = assigneeId === "player" ? player.plannedHours ?? 0 : capacity?.plannedHours ?? 0;
  let pending = 0;
  for (const task of snapshot.state.tasks) {
    if (task.employeeId !== assigneeId || task.day !== snapshot.calendar.day) continue;
    if (task.cultureShift) pending += task.hours - (task.cultureUsedHours ?? 0);
    else if (task.processingShift) pending += task.hours - (task.processingUsedHours ?? 0);
    else if (task.kind === "production") pending += task.hours - (task.productionWorkedHours ?? 0);
    else if (task.status === "running") pending += task.hours;
  }
  // Workshop segments debit their booked hours when funded. Other timed
  // missions only settle on completion. The clock alone posts neither debit.
  pending = Math.max(0, Math.min(booked, round(pending)));
  return {
    totalHours, usedHours: round(booked - pending), reservedHours: round(planned + pending),
    remainingHours: Math.max(0, round(totalHours - booked - planned)),
  };
}
