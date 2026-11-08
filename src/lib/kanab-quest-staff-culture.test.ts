import { describe, expect, it } from "vitest";
import { KQ_GAME_DAY_MS } from "./kanab-quest-business";
import {
  advanceKqStaff, applyKqStaffCommand, createKqStaffState, getKqStaffCalendar,
  getKqStaffCapacity, isKqStaffState, KQ_STAFF_CANDIDATES,
} from "./kanab-quest-staff";
import { getKqStaffWeeklyCost } from "./kanab-quest-staff-weekly";
import type { KqStaffCommand, KqStaffPlannedTask, KqStaffRawSnapshot, KqStaffState } from "./kanab-quest-staff-types";

const START = Date.parse("2026-11-02T08:00:00.000Z");
const dayAt = (day: number, hour = 0) => new Date(START + (day - 1 + hour / 24) * KQ_GAME_DAY_MS).toISOString();
const workerId = "culture-worker";
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
      cultureWorkVersion: 1, weeklyPlanVersion: 1, trimQueueVersion: 2,
      activeRuns: [{ id: "culture-1", name: "Culture active", startedAt: dayAt(1) }],
      processingBatches: [{ id: "batch-1", flowerId: "flower-1", name: "Affinage", startedAt: dayAt(1), readyAt: dayAt(2, 8) }],
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
  return command(raw, { action: "assign", employeeId: workerId, kind: "culture", hours, ...(targetId ? { targetId } : {}) });
}
function advance(raw: Snapshot, day: number, hour = 0) {
  raw.serverNow = dayAt(day, hour);
  const result = advanceKqStaff(raw);
  raw.state = result.state;
  raw.cashCents -= result.debitCents;
  return result;
}
function plan(raw: Snapshot, ...slots: Array<[number, KqStaffPlannedTask[]]>) {
  const days: KqStaffPlannedTask[][] = [[], [], [], [], []];
  for (const [weekday, tasks] of slots) days[weekday] = tasks;
  return command(raw, { action: "set-weekly-plan", employeeId: workerId, enabled: true, days, expectedWeeklyCostCents: getKqStaffWeeklyCost(days) });
}

describe("culture stage reservations", () => {
  it("reserves two hours without granting passive results or experience, even after two hours", () => {
    const raw = fixture();
    expect(reserve(raw, 2, "culture-1")).toMatchObject({ effects: [], debitCents: 0 });
    expect(raw.state.tasks[0]).toMatchObject({ kind: "culture", cultureShift: true, cultureUsedHours: 0, hours: 2, startedAt: dayAt(1), completesAt: dayAt(2), targetId: "culture-1", status: "running" });
    expect(raw.state.employees[0].workDays["1"].usedHours).toBe(2);
    expect(advance(raw, 1, 3).effects).toEqual([]);
    expect(raw.state.tasks[0].status).toBe("running");
    expect(advance(raw, 2).effects).toEqual([]);
    expect(raw.state.tasks[0]).toMatchObject({ status: "completed", cultureUsedHours: 0 });
    expect(raw.state.tasks[0].outcome).toContain("0 h utilisées sur 2 h");
    expect(raw.state.employees[0]).toMatchObject({ skills: { culture: 0 }, completedTasks: 0 });
  });

  it("keeps a three-hour budget available until day end, independently of trait or current timed work", () => {
    const raw = fixture();
    raw.state.employees[0].trait = "meticulous";
    raw.serverNow = dayAt(1, 22);
    command(raw, { action: "assign", employeeId: workerId, kind: "communication", hours: 1 });
    reserve(raw, 3);
    expect(raw.state.tasks[1]).toMatchObject({ startedAt: dayAt(1, 22), completesAt: dayAt(2), hours: 3, cultureUsedHours: 0 });
    expect(raw.state.tasks[1].targetId).toBeUndefined();
    expect(raw.state.employees[0].workDays["1"].usedHours).toBe(4);
  });

  it("preserves stage consumption and XP committed by SQL, and records partial completion only once", () => {
    const raw = fixture();
    reserve(raw, 3);
    // The roll transaction already awarded two played stages, including the learner bonus.
    raw.state.tasks[0].cultureUsedHours = 1;
    raw.state.employees[0].skills.culture = 15;
    advance(raw, 1, 12);
    expect(raw.state.tasks[0].cultureUsedHours).toBe(1);
    expect(advance(raw, 2).effects).toEqual([]);
    expect(raw.state.tasks[0].outcome).toContain("1 h utilisées sur 3 h");
    expect(raw.state.tasks[0].outcome).toContain("2 étapes accompagnées");
    expect(raw.state.employees[0]).toMatchObject({ skills: { culture: 15 }, completedTasks: 1 });
    advance(raw, 2, 1);
    expect(raw.state.employees[0]).toMatchObject({ skills: { culture: 15 }, completedTasks: 1 });
    expect(raw.state.employees[0].workDays["1"].usedHours).toBe(3);
  });

  it("does not complete or reward a fully consumed SQL reservation a second time", () => {
    const raw = fixture();
    reserve(raw, 3);
    Object.assign(raw.state.tasks[0], { cultureUsedHours: 3, status: "completed", outcome: "Six étapes jouées, budget épuisé." });
    Object.assign(raw.state.employees[0], { completedTasks: 1 });
    raw.state.employees[0].skills.culture = 45;
    const task = structuredClone(raw.state.tasks[0]);
    expect(advance(raw, 2).effects).toEqual([]);
    expect(raw.state.tasks[0]).toEqual(task);
    expect(raw.state.employees[0]).toMatchObject({ skills: { culture: 45 }, completedTasks: 1 });
  });

  it("accepts an unbound reservation without an active culture and rejects a stale explicit target", () => {
    const raw = fixture();
    raw.context.activeRuns = [];
    reserve(raw, 3);
    expect(raw.state.tasks[0].targetId).toBeUndefined();
    const before = structuredClone(raw);
    expect(() => reserve(raw, 1, "missing-culture")).toThrow(/culture active/);
    expect(raw).toEqual(before);
  });

  it("shares the daily capacity with other jobs and starts a fresh budget on the next day", () => {
    const raw = fixture();
    reserve(raw, 2);
    command(raw, { action: "assign", employeeId: workerId, kind: "communication", hours: 5 });
    expect(raw.state.tasks[1].startedAt).toBe(dayAt(1));
    expect(getKqStaffCapacity(raw.state.employees[0], getKqStaffCalendar(dayAt(1), dayAt(1))).remainingHours).toBe(0);
    expect(() => reserve(raw, 0.5)).toThrow(/heures disponibles/);
    advance(raw, 2);
    reserve(raw, 3);
    expect(raw.state.employees[0].workDays).toMatchObject({ "1": { usedHours: 7 }, "2": { usedHours: 3 } });
  });

  it.each([0, 0.25, 7.5, Number.NaN])("rejects an invalid culture budget of %s hours", hours => {
    expect(() => reserve(fixture(), hours)).toThrow();
  });

  it.each(["leave", "weekend", "part-time rest", "contract end"])("respects %s when reserving culture", reason => {
    const raw = fixture();
    if (reason === "leave") raw.state.employees[0].leave.push({ id: "leave", startDay: 1, endDay: 1, days: 1 });
    if (reason === "weekend") raw.serverNow = dayAt(6);
    if (reason === "part-time rest") { raw.state.employees[0].weeklyHours = 7; raw.serverNow = dayAt(2); }
    if (reason === "contract end") raw.state.employees[0].endsAt = dayAt(1, 12);
    expect(() => reserve(raw)).toThrow();
    expect(raw.state.tasks).toEqual([]);
  });

  it("leaves training and other timed jobs in their own chronological queue", () => {
    const raw = fixture();
    reserve(raw, 2);
    command(raw, { action: "assign", employeeId: workerId, kind: "communication", hours: 1 });
    command(raw, { action: "train", employeeId: workerId, skill: "sales", hours: 2, expectedCostCents: 7000 });
    expect(raw.state.tasks.slice(1).map(task => [task.startedAt, task.completesAt])).toEqual([
      [dayAt(1), dayAt(1, 1)], [dayAt(1, 1), dayAt(1, 3)],
    ]);
    expect(raw.state.employees[0].workDays["1"].usedHours).toBe(5);
  });

  it.each([true, false])("does not block trim with a culture reservation (shared queue: %s)", shared => {
    const raw = fixture();
    if (!shared) delete raw.context.trimQueueVersion;
    reserve(raw, 3);
    command(raw, { action: "trim", employeeId: workerId, mode: "manual", hours: 1, flowerId: "trim-1", expectedCostCents: 0 });
    expect(raw.state.tasks[1]).toMatchObject({ kind: "trim", startedAt: dayAt(1) });
    expect(raw.state.employees[0].workDays["1"].usedHours).toBe(4);
  });

  it("allows immediate invoice work within the unreserved daily hours", () => {
    const raw = fixture();
    reserve(raw, 3);
    const result = command(raw, { action: "pay-invoice", employeeId: workerId, invoiceId: "invoice-1", expectedCents: 1000 });
    expect(result.effects).toEqual([{ kind: "supplier-payment", invoiceId: "invoice-1", amountCents: 1000 }]);
    expect(raw.state.employees[0].workDays["1"].usedHours).toBe(3.5);
  });

  it("preserves legacy employee culture and player culture as timed missions", () => {
    const legacy = fixture();
    delete legacy.context.cultureWorkVersion;
    reserve(legacy, 2, "culture-1");
    expect(legacy.state.tasks[0].cultureShift).toBeUndefined();
    expect(advance(legacy, 1, 3).effects).toEqual([expect.objectContaining({ kind: "culture", runId: "culture-1" })]);
    expect(legacy.state.employees[0].skills.culture).toBe(30);
    const player = fixture();
    command(player, { action: "player-assign", kind: "culture", hours: 2, targetId: "culture-1", expectedCostCents: 0 });
    expect(player.state.tasks[0].cultureShift).toBeUndefined();
    expect(advance(player, 1, 3).effects).toEqual([expect.objectContaining({ kind: "culture", runId: "culture-1" })]);
    expect(player.state.playerSkills?.culture).toBe(24);
  });
});

describe("culture reservations in the weekly template", () => {
  it("repeats an unbound budget next week even without any culture, without retroactive XP", () => {
    const raw = fixture();
    raw.context.activeRuns = [];
    plan(raw, [1, [{ kind: "culture", hours: 3 }]]);
    advance(raw, 2);
    const first = raw.state.tasks[0];
    expect(first).toMatchObject({ cultureShift: true, hours: 3, cultureUsedHours: 0, day: 2, weeklySlot: 0, weeklyCostCents: 0 });
    expect(first.targetId).toBeUndefined();
    expect(advance(raw, 9).effects).toEqual([]);
    expect(raw.state.tasks.map(task => [task.day, task.status])).toEqual([[2, "completed"], [9, "running"]]);
    expect(raw.state.tasks[1].id).not.toBe(first.id);
    expect(raw.state.employees[0]).toMatchObject({ skills: { culture: 0 }, completedTasks: 0 });
    expect(raw.state.employees[0].workDays).toMatchObject({ "2": { usedHours: 3 }, "9": { usedHours: 3 } });
    expect(raw.state.employees[0].workDays["6"]).toBeUndefined();
    expect(raw.state.employees[0].workDays["7"]).toBeUndefined();
  });

  it("skips only a missing explicit target and preserves a following general reservation", () => {
    const raw = fixture();
    raw.context.activeRuns = [];
    plan(raw, [1, [{ kind: "culture", hours: 2, targetId: "missing" }, { kind: "culture", hours: 3 }]]);
    advance(raw, 2);
    expect(raw.state.tasks).toHaveLength(1);
    expect(raw.state.tasks[0]).toMatchObject({ cultureShift: true, hours: 3, weeklySlot: 1 });
    expect(raw.state.employees[0].weeklyPlan!.history.at(-1)).toMatchObject({ day: 2, started: 1, skipped: 1 });
  });

  it("uses the culture budget alongside communication and training without delaying their slots", () => {
    const raw = fixture();
    plan(raw, [1, [{ kind: "culture", hours: 3 }, { kind: "communication", hours: 1 }, { kind: "training", hours: 2, skill: "culture" }]]);
    expect(advance(raw, 2).debitCents).toBe(7000);
    expect(raw.state.tasks.map(task => task.startedAt)).toEqual([dayAt(2), dayAt(2), dayAt(2, 1)]);
    expect(raw.state.employees[0].workDays["2"].usedHours).toBe(6);
    advance(raw, 2, 4);
    expect(raw.state.tasks[0]).toMatchObject({ status: "running", cultureUsedHours: 0 });
    expect(raw.state.employees[0].skills.culture).toBe(150);
  });

  it("selects a processing batch that finishes before the culture reservation expires", () => {
    const raw = fixture();
    plan(raw, [1, [{ kind: "culture", hours: 3 }, { kind: "processing", hours: 2 }]]);
    advance(raw, 2);
    expect(raw.state.tasks).toHaveLength(2);
    expect(raw.state.tasks[1]).toMatchObject({ kind: "processing", targetId: "flower-1", startedAt: dayAt(2), completesAt: dayAt(2, 2) });
  });

  it("skips a day on leave and resumes the same culture budget the next week", () => {
    const raw = fixture();
    raw.state.employees[0].leave.push({ id: "leave", startDay: 2, endDay: 2, days: 1 });
    plan(raw, [1, [{ kind: "culture", hours: 3 }]]);
    advance(raw, 2);
    expect(raw.state.tasks).toEqual([]);
    expect(raw.state.employees[0].weeklyPlan!.history.at(-1)).toMatchObject({ started: 0, skipped: 1, reasons: ["Congé payé."] });
    advance(raw, 9);
    expect(raw.state.tasks).toHaveLength(1);
    expect(raw.state.tasks[0]).toMatchObject({ day: 9, cultureShift: true, cultureUsedHours: 0 });
  });
});

describe("persisted culture reservation validation", () => {
  it.each([
    ["false marker", { cultureShift: false }], ["string marker", { cultureShift: "true" }],
    ["player marker", { employeeId: "player" }], ["wrong kind", { kind: "processing" }],
    ["wrong skill", { skill: "processing" }], ["missing marker", { cultureShift: undefined }],
    ["negative use", { cultureUsedHours: -0.5 }], ["too much use", { cultureUsedHours: 3.5 }],
    ["partial half-hour", { cultureUsedHours: 0.25 }], ["NaN use", { cultureUsedHours: Number.NaN }],
    ["infinite use", { cultureUsedHours: Infinity }], ["string use", { cultureUsedHours: "1" }],
  ])("rejects %s", (_label, changes) => {
    const raw = fixture();
    reserve(raw, 3);
    Object.assign(raw.state.tasks[0], changes);
    expect(isKqStaffState(raw.state)).toBe(false);
  });

  it("accepts consumed budgets and existing tasks that predate culture reservations", () => {
    const raw = fixture();
    reserve(raw, 3);
    raw.state.tasks[0].cultureUsedHours = 2.5;
    expect(isKqStaffState(raw.state)).toBe(true);
    delete raw.state.tasks[0].cultureShift;
    delete raw.state.tasks[0].cultureUsedHours;
    expect(isKqStaffState(raw.state)).toBe(true);
  });
});
