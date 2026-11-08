import type { KqStaffTask } from "./kanab-quest-staff-types";

export type KqStaffTaskActivity = "working" | "available" | "queued" | "waiting" | "completed";

/** Presentation only: an elapsed estimate never settles a task or grants its result. */
export function getKqStaffTaskActivity(task: KqStaffTask, estimatedNow: number): KqStaffTaskActivity {
  if (task.status === "completed") return "completed";
  const start = Date.parse(task.startedAt), end = Date.parse(task.completesAt);
  if (![start, end, estimatedNow].every(Number.isFinite) || end <= start) return "waiting";
  if (estimatedNow >= end) return "waiting";
  if (task.cultureShift && estimatedNow >= start) return (task.cultureUsedHours ?? 0) < task.hours ? "available" : "waiting";
  if (task.processingShift && estimatedNow >= start) return (task.processingUsedHours ?? 0) < task.hours ? "available" : "waiting";
  return estimatedNow < start ? "queued" : "working";
}

export function getKqStaffStationActivity(tasks: KqStaffTask[], estimatedNow: number) {
  const groups = { working: [] as KqStaffTask[], available: [] as KqStaffTask[], queued: [] as KqStaffTask[], waiting: [] as KqStaffTask[] };
  for (const task of tasks) {
    const activity = getKqStaffTaskActivity(task, estimatedNow);
    if (activity !== "completed") groups[activity].push(task);
  }
  const lead = (groups.working.length ? groups.working : groups.available.length ? groups.available : groups.queued.length ? groups.queued : groups.waiting)
    .slice().sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id))[0];
  return { ...groups, lead };
}
