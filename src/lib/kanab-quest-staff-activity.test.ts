import { describe, expect, it } from "vitest";
import { getKqStaffStationActivity, getKqStaffTaskActivity } from "./kanab-quest-staff-activity";
import type { KqStaffTask } from "./kanab-quest-staff-types";

const start = Date.parse("2026-11-07T12:00:00Z"), end = start + 60_000;
const task: KqStaffTask = { id: "task", employeeId: "anna", kind: "culture", skill: "culture", hours: 1, startedAt: new Date(start).toISOString(), completesAt: new Date(end).toISOString(), day: 1, status: "running", trainingCostCents: 0, skillLevel: 1 };

describe("staff activity presentation", () => {
  it("starts at the confirmed beginning and waits for the server at the estimated end", () => {
    expect(getKqStaffTaskActivity(task, start - 1)).toBe("queued");
    expect(getKqStaffTaskActivity(task, start)).toBe("working");
    expect(getKqStaffTaskActivity(task, end - 1)).toBe("working");
    expect(getKqStaffTaskActivity(task, end)).toBe("waiting");
    expect(task.status).toBe("running");
    expect(task.outcome).toBeUndefined();
  });
  it("keeps the authoritative completion even if the displayed clock is unavailable", () => {
    expect(getKqStaffTaskActivity({ ...task, status: "completed" }, NaN)).toBe("completed");
  });
  it("shows a culture reservation as available without animating elapsed time as productive work", () => {
    const shift: KqStaffTask = { ...task, cultureShift: true, cultureUsedHours: 0.5 };
    expect(getKqStaffTaskActivity(shift, start - 1)).toBe("queued");
    expect(getKqStaffTaskActivity(shift, start)).toBe("available");
    expect(getKqStaffTaskActivity(shift, end - 1)).toBe("available");
    expect(getKqStaffTaskActivity(shift, end)).toBe("waiting");
    expect(getKqStaffTaskActivity({ ...shift, cultureUsedHours: 1 }, start)).toBe("waiting");
    expect(getKqStaffTaskActivity({ ...shift, cultureUsedHours: 1, status: "completed" }, NaN)).toBe("completed");
    expect(shift.cultureUsedHours).toBe(0.5);
  });
  it("keeps available culture budgets separate from timed work and ahead of queued work", () => {
    const shift: KqStaffTask = { ...task, id: "shift", cultureShift: true, cultureUsedHours: 0 };
    const queued: KqStaffTask = { ...task, id: "later", startedAt: new Date(end).toISOString(), completesAt: new Date(end + 60_000).toISOString() };
    const availability = getKqStaffStationActivity([queued, shift], start);
    expect(availability.available).toEqual([shift]);
    expect(availability.working).toEqual([]);
    expect(availability.lead).toBe(shift);
    expect(getKqStaffStationActivity([shift, task], start).lead).toBe(task);
  });
  it("does not animate malformed schedules or an unavailable clock", () => {
    for (const value of [NaN, Infinity]) expect(getKqStaffTaskActivity(task, value)).toBe("waiting");
    expect(getKqStaffTaskActivity({ ...task, startedAt: "bad" }, start)).toBe("waiting");
    expect(getKqStaffTaskActivity({ ...task, completesAt: task.startedAt }, start - 1)).toBe("waiting");
  });
  it("shows a working actor before a queued actor and counts distinct confirmed tasks", () => {
    const queued = { ...task, id: "later", employeeId: "mael", startedAt: new Date(end).toISOString(), completesAt: new Date(end + 60_000).toISOString() };
    const waiting = { ...task, id: "elapsed", completesAt: new Date(start - 1).toISOString(), startedAt: new Date(start - 60_000).toISOString() };
    const tasks = [queued, waiting, { ...task, id: "done", status: "completed" as const }, task];
    const before = structuredClone(tasks);
    const activity = getKqStaffStationActivity(tasks, start);
    expect(activity.lead?.employeeId).toBe("anna");
    expect([activity.working.length, activity.queued.length, activity.waiting.length]).toEqual([1, 1, 1]);
    expect(getKqStaffStationActivity(tasks, end).lead?.employeeId).toBe("mael");
    expect(tasks).toEqual(before);
  });
  it("leaves completed-only stations empty", () => {
    expect(getKqStaffStationActivity([{ ...task, status: "completed" }], end).lead).toBeUndefined();
  });
});
