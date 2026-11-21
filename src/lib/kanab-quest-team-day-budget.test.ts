import { describe, expect, it } from "vitest";
import { createKqStaffState, projectKqStaffSnapshot, applyKqStaffCommand } from "./kanab-quest-staff";
import type { KqStaffRawSnapshot } from "./kanab-quest-staff-types";
import { getKqTeamDayBudget, getKqTeamWorkEntries } from "./kanab-quest-team-day-budget";

const start = "2026-11-18T08:00:00.000Z";
const finish = "2026-11-18T08:20:00.000Z";
function snapshot() {
  const raw: KqStaffRawSnapshot = {
    state: createKqStaffState(start), revision: 1, serverNow: start, cashCents: 10000,
    context: { businessStartedAt: start, reputation: 0, instagramFollowers: 0, shopPartners: 0,
      activeRuns: [], processingBatches: [], supplierInvoices: [], dayPlanVersion: 1 },
  };
  return projectKqStaffSnapshot(raw);
}

describe("time available to the team across the farm", () => {
  it("keeps spent gestures, confirmed intervals and manually planned hours distinct after reload", () => {
    const team = snapshot();
    team.state.playerWorkDays["1"] = { usedHours: 2.45 };
    team.state.dayPlans = [{ id: "later", day: 1, assigneeId: "player",
      assignment: { action: "player-assign", kind: "communication", hours: 3, expectedCostCents: 0 } }];
    team.state.playerActions = { day: 1, entries: [{ at: start, domain: "storage", action: "place", hours: .45 }] };
    team.context.teamWork = [{ id: "work", kind: "processing", target: "Lot Jade", assigneeId: "player",
      hours: 2, startedAt: start, completesAt: finish }];
    const reloaded = JSON.parse(JSON.stringify(team));
    expect(getKqTeamDayBudget(reloaded, "player"))
      .toEqual({ totalHours: 12, usedHours: 2.45, reservedHours: 3, remainingHours: 6.55 });
    expect(getKqTeamWorkEntries(team)).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Ranger un lot", place: "Stockage", hours: .45, instant: true }),
      expect.objectContaining({ label: "Transformer le lot", place: "Atelier · Lot Jade", completesAt: finish }),
    ]));
    expect(getKqTeamDayBudget({ ...reloaded, serverNow: finish }, "player")).toEqual(getKqTeamDayBudget(reloaded, "player"));
    expect(getKqTeamWorkEntries({ ...team, calendar: { ...team.calendar, day: 2 }, context: { ...team.context, teamWork: [] } })).toEqual([]);
  });
  it("keeps a timed mission reserved until its actual settlement without interpolating the clock", () => {
    const initial = snapshot();
    const command = { action: "player-assign", kind: "administration", hours: 2, expectedCostCents: 0 } as const;
    const team = { ...initial, state: applyKqStaffCommand(initial, command, "admin").state };
    for (const serverNow of [start, "2026-11-18T08:10:00Z", finish]) {
      expect(getKqTeamDayBudget({ ...team, serverNow }, "player"))
        .toEqual({ totalHours: 12, usedHours: 0, reservedHours: 2, remainingHours: 10 });
    }
    const settled = applyKqStaffCommand({ ...team, serverNow: finish }, { action: "settle" }, "settle");
    expect(getKqTeamDayBudget({ ...team, state: settled.state }, "player"))
      .toEqual({ totalHours: 12, usedHours: 2, reservedHours: 0, remainingHours: 10 });
  });
  it.each([
    { kind: "culture" as const, skill: "culture" as const, cultureShift: true as const, cultureUsedHours: .5 },
    { kind: "processing" as const, skill: "processing" as const, processingShift: true as const, processingUsedHours: .5 },
    { kind: "production" as const, skill: "culture" as const, productionWorkedHours: .5 },
  ])("uses the recorded partial work of a $kind shift", task => {
    const team = snapshot();
    team.state.employees = [{ ...team.candidates[0], id: "alice", status: "active", contract: "cdi",
      weeklyHours: 35, hiredAt: start, endsAt: null, reason: "permanent", paidUntil: start, nextPayrollAt: finish,
      grossEarnedCents: 0, overtimeGrossCents: 0, finalPaid: false, workDays: { "1": { usedHours: 2, extraHours: 0 } },
      leave: [], completedTasks: 0 }];
    team.state.tasks = [{ id: "shift", employeeId: "alice", day: 1, trainingCostCents: 0, skillLevel: 1,
      startedAt: start, completesAt: finish, status: "running", hours: 2, ...task }];
    if (task.kind === "processing") team.context.teamWork = [{ id: "segment", kind: "processing",
      assigneeId: "alice", target: "Lot Jade", hours: .5, startedAt: start, completesAt: finish }];
    expect(getKqTeamDayBudget(team, "alice"))
      .toEqual({ totalHours: 7, usedHours: .5, reservedHours: 1.5, remainingHours: 5 });
  });
  it("queues a timed personal mission after active human work at the workshop", () => {
    const team = snapshot();
    team.context.teamWork = [{ id: "work", kind: "processing", target: "Lot Jade", assigneeId: "player",
      hours: 2, startedAt: start, completesAt: "2026-11-18T08:20:00.000123Z" }];
    const task = { action: "player-assign", kind: "administration", hours: .5, expectedCostCents: 0 } as const;
    const queued = applyKqStaffCommand(team, task, "admin").state.tasks[0];
    expect(queued.startedAt).toBe("2026-11-18T08:20:00.001Z");
    expect(() => applyKqStaffCommand(team, { action: "start-team-task", assignment: task, expectedVersion: 0, expectedDay: 1 }, "now")).toThrow(/travaille déjà/);
  });

  it.each(["player", "alice"])("shows cleaning in %s’s day and queues new work behind it", assigneeId => {
    const team = snapshot();
    const employee = { ...team.candidates[0], id: "alice", status: "active" as const, contract: "cdi" as const,
      weeklyHours: 35, hiredAt: start, endsAt: null, reason: "permanent" as const, paidUntil: start, nextPayrollAt: finish,
      grossEarnedCents: 0, overtimeGrossCents: 0, finalPaid: false, workDays: { "1": { usedHours: assigneeId === "alice" ? .5 : 0, extraHours: 0 } },
      leave: [], completedTasks: 0 };
    team.state.employees = [employee];
    team.state.playerWorkDays["1"] = { usedHours: assigneeId === "player" ? .5 : 0 };
    const end = "2026-11-18T08:05:00Z";
    team.context.teamWork = [{ id: "cleaning", kind: "cleaning", target: "Passer l’aspirateur", assigneeId,
      hours: .5, startedAt: start, completesAt: end }];
    expect(getKqTeamWorkEntries(team)).toEqual([expect.objectContaining({ label: "Passer l’aspirateur", place: "Hygiène · Entrepôt", instant: false, assigneeId })]);
    expect(getKqTeamDayBudget(team, assigneeId)).toMatchObject({ usedHours: 0, reservedHours: .5 });
    expect(getKqTeamDayBudget({ ...team, serverNow: end }, assigneeId)).toMatchObject({ usedHours: .5, reservedHours: 0 });
    const assignment = assigneeId === "player"
      ? { action: "player-assign", kind: "administration", hours: .5, expectedCostCents: 0 } as const
      : { action: "assign", employeeId: assigneeId, kind: "administration", hours: .5 } as const;
    expect(applyKqStaffCommand(team, assignment, "next").state.tasks[0].startedAt).toBe("2026-11-18T08:05:00.000Z");
    expect(() => applyKqStaffCommand(team, { action: "start-team-task", assignment, expectedVersion: 0, expectedDay: 1 }, "now")).toThrow(/travaille déjà/);
  });
});
