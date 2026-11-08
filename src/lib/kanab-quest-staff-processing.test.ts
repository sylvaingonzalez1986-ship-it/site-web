import { describe, expect, it } from "vitest";
import { KQ_GAME_DAY_MS } from "./kanab-quest-business";
import {
  advanceKqStaff, applyKqStaffCommand, createKqStaffState, getKqStaffCalendar,
  getKqStaffCapacity, isKqStaffState, KQ_STAFF_CANDIDATES,
} from "./kanab-quest-staff";
import { getKqStaffStationActivity, getKqStaffTaskActivity } from "./kanab-quest-staff-activity";
import { getKqStaffWeeklyCost } from "./kanab-quest-staff-weekly";
import type { KqStaffCommand, KqStaffPlannedTask, KqStaffRawSnapshot, KqStaffState } from "./kanab-quest-staff-types";

const START = Date.parse("2026-11-02T08:00:00.000Z");
const dayAt = (day: number, hour = 0) => new Date(START + (day - 1 + hour / 24) * KQ_GAME_DAY_MS).toISOString();
const workerId = "processing-worker";
type Snapshot = KqStaffRawSnapshot & { state: KqStaffState };

function fixture(): Snapshot {
  const state = createKqStaffState(dayAt(1));
  state.employees.push({
    ...structuredClone(KQ_STAFF_CANDIDATES[0]), id: workerId, trait: "learner",
    skills: { culture: 0, processing: 0, communication: 0, sales: 0, administration: 0 },
    contract: "cdi", weeklyHours: 35, hiredAt: dayAt(1), endsAt: null, reason: "permanent",
    status: "active", nextPayrollAt: dayAt(31), paidUntil: dayAt(1), grossEarnedCents: 0,
    overtimeGrossCents: 0, finalPaid: false, workDays: {}, leave: [], completedTasks: 0,
  });
  return {
    state, revision: 0, archiveCount: 0, serverNow: dayAt(1), cashCents: 1_000_000,
    context: {
      businessStartedAt: dayAt(1), reputation: 0, instagramFollowers: 0, shopPartners: 0,
      cultureWorkVersion: 1, processingWorkVersion: 1, weeklyPlanVersion: 1, trimQueueVersion: 2,
      activeRuns: [], processingJobs: [], processingBatches: [],
      supplierInvoices: [{ id: "invoice-1", remainingCents: 1000, dueAt: dayAt(3) }],
      trimLots: [{ flowerId: "trim-1", name: "Récolte", requiredWork: 6, completedWork: 0, mode: null, completedAt: null, totalGrams: 600, completedGrams: 0, createdAt: dayAt(1) }],
    },
  };
}
function command(raw: Snapshot, value: KqStaffCommand, id = `task-${raw.state.tasks.length}`) {
  const result = applyKqStaffCommand(raw, value, id);
  raw.state = result.state;
  raw.cashCents -= result.debitCents;
  return result;
}
function reserve(raw: Snapshot, hours = 2, targetId?: string) {
  return command(raw, { action: "assign", employeeId: workerId, kind: "processing", hours, ...(targetId !== undefined ? { targetId } : {}) });
}
function advance(raw: Snapshot, day: number, hour = 0) {
  raw.serverNow = dayAt(day, hour);
  const result = advanceKqStaff(raw);
  raw.state = result.state;
  raw.cashCents -= result.debitCents;
  return result;
}
function plan(raw: Snapshot, tasks: KqStaffPlannedTask[]) {
  const days: KqStaffPlannedTask[][] = [[], tasks, [], [], []];
  return command(raw, { action: "set-weekly-plan", employeeId: workerId, enabled: true, days, expectedWeeklyCostCents: getKqStaffWeeklyCost(days) });
}
function legacyBatch(raw: Snapshot, flowerId = "legacy-flower") {
  raw.context.processingBatches.push({ id: `batch-${flowerId}`, flowerId, name: "Ancienne transformation", startedAt: dayAt(1), readyAt: dayAt(3) });
}

describe("daily processing reservations", () => {
  it("reserves before any lot exists, debits the shared day once and expires without passive XP or speed effects", () => {
    const raw = fixture();
    expect(reserve(raw)).toMatchObject({ effects: [], debitCents: 0 });
    expect(raw.state.tasks[0]).toMatchObject({ kind: "processing", skill: "processing", processingShift: true, processingUsedHours: 0, hours: 2, startedAt: dayAt(1), completesAt: dayAt(2) });
    expect(raw.state.tasks[0].targetId).toBeUndefined();
    expect(raw.state.employees[0].workDays["1"].usedHours).toBe(2);
    expect(advance(raw, 1, 3).effects).toEqual([]);
    expect(raw.state.tasks[0].status).toBe("running");
    expect(advance(raw, 2).effects).toEqual([]);
    expect(raw.state.tasks[0]).toMatchObject({ status: "completed", processingUsedHours: 0 });
    expect(raw.state.tasks[0].outcome).toContain("0 h utilisées sur 2 h");
    expect(raw.state.employees[0]).toMatchObject({ skills: { processing: 0 }, completedTasks: 0 });
  });

  it("preserves SQL experience and counts a partly used reservation only once on expiry", () => {
    const raw = fixture();
    reserve(raw, 3);
    raw.state.tasks[0].processingUsedHours = 1.5;
    raw.state.employees[0].skills.processing = 23;
    expect(advance(raw, 2).effects).toEqual([]);
    expect(raw.state.tasks[0].outcome).toContain("1,5 h utilisées sur 3 h");
    advance(raw, 2, 1);
    expect(raw.state.employees[0]).toMatchObject({ skills: { processing: 23 }, completedTasks: 1 });
    expect(raw.state.employees[0].workDays["1"].usedHours).toBe(3);
  });

  it("does not complete or reward a reservation already exhausted by SQL", () => {
    const raw = fixture();
    reserve(raw, 2);
    Object.assign(raw.state.tasks[0], { processingUsedHours: 2, status: "completed", outcome: "Réservation utilisée." });
    Object.assign(raw.state.employees[0], { completedTasks: 1 });
    raw.state.employees[0].skills.processing = 30;
    const task = structuredClone(raw.state.tasks[0]);
    expect(advance(raw, 2).effects).toEqual([]);
    expect(raw.state.tasks[0]).toEqual(task);
    expect(raw.state.employees[0]).toMatchObject({ skills: { processing: 30 }, completedTasks: 1 });
  });

  it("starts immediately late in the day regardless of trait and existing timed missions", () => {
    const raw = fixture();
    raw.state.employees[0].trait = "meticulous";
    raw.serverNow = dayAt(1, 22);
    command(raw, { action: "assign", employeeId: workerId, kind: "communication", hours: 1 });
    reserve(raw, 3);
    expect(raw.state.tasks[1]).toMatchObject({ startedAt: dayAt(1, 22), completesAt: dayAt(2), hours: 3 });
  });

  it("shares capacity with Culture and training without occupying the chronological queue", () => {
    const raw = fixture();
    reserve(raw, 2);
    command(raw, { action: "assign", employeeId: workerId, kind: "culture", hours: 2 });
    command(raw, { action: "assign", employeeId: workerId, kind: "communication", hours: 1 });
    command(raw, { action: "train", employeeId: workerId, skill: "sales", hours: 2, expectedCostCents: 7000 });
    expect(raw.state.tasks.slice(2).map(task => [task.startedAt, task.completesAt])).toEqual([[dayAt(1), dayAt(1, 1)], [dayAt(1, 1), dayAt(1, 3)]]);
    expect(getKqStaffCapacity(raw.state.employees[0], getKqStaffCalendar(dayAt(1), dayAt(1))).remainingHours).toBe(0);
    expect(() => reserve(raw, 0.5)).toThrow(/heures disponibles/);
    advance(raw, 2);
    reserve(raw, 3);
    expect(raw.state.employees[0].workDays).toMatchObject({ "1": { usedHours: 7 }, "2": { usedHours: 3 } });
  });

  it.each([true, false])("does not block trim or immediate invoice work (shared trim %s)", shared => {
    const raw = fixture();
    if (!shared) delete raw.context.trimQueueVersion;
    reserve(raw, 3);
    expect(command(raw, { action: "pay-invoice", employeeId: workerId, invoiceId: "invoice-1", expectedCents: 1000 }).effects).toEqual([{ kind: "supplier-payment", invoiceId: "invoice-1", amountCents: 1000 }]);
    command(raw, { action: "trim", employeeId: workerId, mode: "manual", hours: 1, flowerId: "trim-1", expectedCostCents: 0 });
    expect(raw.state.tasks[1]).toMatchObject({ kind: "trim", startedAt: dayAt(1) });
    expect(raw.state.employees[0].workDays["1"].usedHours).toBe(4.5);
  });

  it.each(["running", "blocked", "passive"] as const)("accepts an existing %s job as an explicit target", status => {
    const raw = fixture();
    raw.context.processingJobs = [{ flowerId: "new-flower", status, createdAt: dayAt(1) }];
    reserve(raw, 2, "new-flower");
    expect(raw.state.tasks[0]).toMatchObject({ targetId: "new-flower", processingShift: true });
  });

  it("accepts a currently active legacy target even if it finishes before reservation expiry", () => {
    const raw = fixture();
    legacyBatch(raw);
    raw.context.processingBatches[0].readyAt = dayAt(1, 1);
    reserve(raw, 2, "legacy-flower");
    expect(raw.state.tasks[0]).toMatchObject({ targetId: "legacy-flower", completesAt: dayAt(2) });
  });

  it.each(["missing", "completed", "future", "expired legacy"])("rejects a %s explicit target without changing the budget", reason => {
    const raw = fixture();
    if (reason === "completed") raw.context.processingJobs = [{ flowerId: "target", status: "completed", createdAt: dayAt(1) }];
    if (reason === "future") raw.context.processingJobs = [{ flowerId: "target", status: "blocked", createdAt: dayAt(2) }];
    if (reason === "expired legacy") { legacyBatch(raw, "target"); raw.context.processingBatches[0].readyAt = dayAt(1); }
    const before = structuredClone(raw);
    expect(() => reserve(raw, 2, "target")).toThrow(/transformation active/);
    expect(raw).toEqual(before);
  });

  it.each(["leave", "weekend", "contract end"])("respects %s", reason => {
    const raw = fixture();
    if (reason === "leave") raw.state.employees[0].leave.push({ id: "leave", startDay: 1, endDay: 1, days: 1 });
    if (reason === "weekend") raw.serverNow = dayAt(6);
    if (reason === "contract end") raw.state.employees[0].endsAt = dayAt(1, 12);
    expect(() => reserve(raw)).toThrow();
    expect(raw.state.tasks).toEqual([]);
  });
});

describe("weekly processing reservations", () => {
  it("reserves all transformations without lots, repeats next week and never creates retroactive XP", () => {
    const raw = fixture();
    plan(raw, [{ kind: "processing", hours: 3 }]);
    advance(raw, 2);
    expect(raw.state.tasks[0]).toMatchObject({ processingShift: true, processingUsedHours: 0, day: 2, weeklySlot: 0, weeklyCostCents: 0 });
    expect(raw.state.tasks[0].targetId).toBeUndefined();
    expect(advance(raw, 9).effects).toEqual([]);
    expect(raw.state.tasks.map(task => [task.day, task.status])).toEqual([[2, "completed"], [9, "running"]]);
    expect(raw.state.employees[0]).toMatchObject({ skills: { processing: 0 }, completedTasks: 0 });
    expect(raw.state.employees[0].workDays).toMatchObject({ "2": { usedHours: 3 }, "9": { usedHours: 3 } });
  });

  it("skips a target created after an occurrence, but preserves the general budget and timed work", () => {
    const raw = fixture();
    raw.context.processingJobs = [{ flowerId: "new-flower", status: "blocked", createdAt: dayAt(3) }];
    plan(raw, [{ kind: "processing", hours: 2, targetId: "new-flower" }, { kind: "processing", hours: 3 }, { kind: "communication", hours: 1 }]);
    advance(raw, 3);
    expect(raw.state.tasks.map(task => [task.kind, task.weeklySlot, task.startedAt])).toEqual([["processing", 1, dayAt(2)], ["communication", 2, dayAt(2)]]);
    expect(raw.state.employees[0].weeklyPlan!.history.find(row => row.day === 2)).toMatchObject({ started: 2, skipped: 1 });
    expect(raw.state.employees[0].skills.processing).toBe(0);
  });
});

describe("legacy processing compatibility and player guard", () => {
  it("keeps previously booked employee missions and legacy player assignments as timed jobs", () => {
    const raw = fixture();
    delete raw.context.processingWorkVersion;
    legacyBatch(raw);
    reserve(raw, 2, "legacy-flower");
    expect(raw.state.tasks[0].processingShift).toBeUndefined();
    raw.context.processingWorkVersion = 1;
    expect(advance(raw, 1, 3).effects).toEqual([expect.objectContaining({ kind: "processing", flowerId: "legacy-flower", secondsSaved: 90 })]);
    expect(raw.state.employees[0].skills.processing).toBe(30);
    command(raw, { action: "player-assign", kind: "processing", hours: 2, targetId: "legacy-flower", expectedCostCents: 0 });
    expect(raw.state.tasks[1].processingShift).toBeUndefined();
    expect(advance(raw, 1, 6).effects).toEqual([expect.objectContaining({ kind: "processing", flowerId: "legacy-flower" })]);
    expect(raw.state.playerSkills?.processing).toBe(24);
  });

  it("rejects player assignments on new jobs even if a sentinel legacy row accidentally leaks into context", () => {
    const raw = fixture();
    raw.context.processingJobs = [{ flowerId: "new-flower", status: "blocked", createdAt: dayAt(1) }];
    legacyBatch(raw, "new-flower");
    raw.context.processingBatches[0].readyAt = "9999-01-01T00:00:00.000Z";
    const before = structuredClone(raw);
    expect(() => command(raw, { action: "player-assign", kind: "processing", hours: 2, targetId: "new-flower", expectedCostCents: 0 })).toThrow(/depuis l’Atelier/);
    expect(raw).toEqual(before);
  });

  it("does not apply an old mission's secondsSaved to a new job", () => {
    const raw = fixture();
    delete raw.context.processingWorkVersion;
    legacyBatch(raw, "same-flower");
    reserve(raw, 2, "same-flower");
    raw.context.processingWorkVersion = 1;
    raw.context.processingJobs = [{ flowerId: "same-flower", status: "running", createdAt: dayAt(1, 1) }];
    expect(advance(raw, 1, 3).effects).toEqual([]);
    expect(raw.state.tasks[0].status).toBe("completed");
  });
});

describe("processing reservation validation and activity", () => {
  it.each([
    ["false marker", { processingShift: false }], ["string marker", { processingShift: "true" }],
    ["player", { employeeId: "player" }], ["wrong kind", { kind: "culture" }], ["wrong skill", { skill: "culture" }],
    ["orphan usage", { processingShift: undefined }], ["missing usage", { processingUsedHours: undefined }],
    ["negative usage", { processingUsedHours: -0.5 }], ["excess usage", { processingUsedHours: 3.5 }],
    ["fractional usage", { processingUsedHours: 0.25 }], ["NaN usage", { processingUsedHours: NaN }],
    ["infinite usage", { processingUsedHours: Infinity }], ["string usage", { processingUsedHours: "1" }],
    ["zero budget", { hours: 0 }], ["fractional budget", { hours: 2.25 }], ["infinite budget", { hours: Infinity }],
    ["string budget", { hours: "3" }], ["overlong budget", { hours: 10.5 }],
  ])("rejects %s", (_label, changes) => {
    const raw = fixture();
    reserve(raw, 3);
    Object.assign(raw.state.tasks[0], changes);
    expect(isKqStaffState(raw.state)).toBe(false);
  });

  it.each([0, 0.5, 2.5, 3])("accepts %s used hours and preserves pre-reservation task compatibility", processingUsedHours => {
    const raw = fixture();
    reserve(raw, 3);
    raw.state.tasks[0].processingUsedHours = processingUsedHours;
    expect(isKqStaffState(raw.state)).toBe(true);
    delete raw.state.tasks[0].processingShift;
    delete raw.state.tasks[0].processingUsedHours;
    expect(isKqStaffState(raw.state)).toBe(true);
  });

  it("shows a remaining budget as available without animating elapsed time or changing its use", () => {
    const raw = fixture();
    reserve(raw, 3);
    const task = raw.state.tasks[0];
    task.processingUsedHours = 0.5;
    expect(getKqStaffTaskActivity(task, START - 1)).toBe("queued");
    expect(getKqStaffTaskActivity(task, START)).toBe("available");
    expect(getKqStaffTaskActivity(task, Date.parse(dayAt(1, 23)))).toBe("available");
    expect(getKqStaffStationActivity([task], START).available).toEqual([task]);
    expect(getKqStaffTaskActivity(task, Date.parse(dayAt(2)))).toBe("waiting");
    expect(getKqStaffTaskActivity({ ...task, processingUsedHours: 3 }, START)).toBe("waiting");
    expect(getKqStaffTaskActivity({ ...task, status: "completed" }, NaN)).toBe("completed");
    expect(task.processingUsedHours).toBe(0.5);
  });
});
