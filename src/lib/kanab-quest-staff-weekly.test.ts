import { describe, expect, it } from "vitest";
import { KQ_GAME_DAY_MS } from "./kanab-quest-business";
import {
  advanceKqStaff, applyKqStaffCommand, getKqStaffMonthlyCost, hasDueKqStaffWeeklyWork,
  KQ_STAFF_CANDIDATES, KQ_STAFF_CITIES, parseKqStaffCommand,
} from "./kanab-quest-staff";
import {
  getKqStaffPlannedTaskCost, getKqStaffWeeklyCost, parseKqStaffWeeklyDays, validateKqStaffWeeklyDays,
} from "./kanab-quest-staff-weekly";
import type { KqStaffCommand, KqStaffEffect, KqStaffPlannedTask, KqStaffRawSnapshot, KqStaffState } from "./kanab-quest-staff-types";

const START = Date.parse("2026-11-02T08:00:00.000Z");
const dayAt = (day: number, hour = 0) => new Date(START + (day - 1 + hour / 24) * KQ_GAME_DAY_MS).toISOString();
const days = (...entries: Array<[number, KqStaffPlannedTask[]]>) => {
  const result: KqStaffPlannedTask[][] = [[], [], [], [], []];
  for (const [weekday, slots] of entries) result[weekday] = slots;
  return result;
};
const communication = (hours = 1): KqStaffPlannedTask => ({ kind: "communication", hours });
const training = (hours = 2): KqStaffPlannedTask => ({ kind: "training", hours, skill: "processing" });
const sales = (): KqStaffPlannedTask => ({ kind: "sales", hours: 2, cityId: "brest" });
const employeeId = "weekly-anna";

function fixture(weeklyHours = 35): KqStaffRawSnapshot & { state: KqStaffState } {
  const raw: KqStaffRawSnapshot = {
    state: null, revision: 0, archiveCount: 0, serverNow: dayAt(1), cashCents: 1_000_000,
    context: {
      businessStartedAt: dayAt(1), reputation: 0, instagramFollowers: 0, shopPartners: 0,
      weeklyPlanVersion: 1, trimQueueVersion: 2,
      activeRuns: [{ id: "culture-1", name: "Culture en cours", startedAt: dayAt(1) }],
      processingBatches: [{ id: "batch-1", flowerId: "flower-1", name: "Fleurs en affinage", startedAt: dayAt(1), readyAt: dayAt(25) }],
      supplierInvoices: [],
      trimLots: [{ flowerId: "trim-1", name: "Récolte brute", requiredWork: 6, completedWork: 0, mode: null, completedAt: null, totalGrams: 600, completedGrams: 0, createdAt: dayAt(1) }],
    },
  };
  const candidate = KQ_STAFF_CANDIDATES.find(person => person.code === "anna")!;
  const hired = applyKqStaffCommand(raw, {
    action: "hire", candidateCode: "anna", weeklyHours, contract: "cdi", durationMonths: 0,
    reason: "permanent", expectedMonthlyCostCents: getKqStaffMonthlyCost(candidate, weeklyHours).totalCents,
  }, employeeId);
  return { ...raw, state: hired.state };
}

function applyEffects(raw: KqStaffRawSnapshot, effects: KqStaffEffect[]) {
  for (const effect of effects) {
    if (effect.kind === "trim-work") {
      const lot = raw.context.trimLots!.find(item => item.flowerId === effect.flowerId)!;
      lot.completedGrams = Math.min(lot.totalGrams!, Number((lot.completedGrams! + (effect.unit === "g" ? effect.work : effect.work / lot.requiredWork * lot.totalGrams!)).toFixed(6)));
      lot.mode = effect.mode;
      lot.completedWork = lot.completedGrams === lot.totalGrams ? lot.requiredWork : Math.min(5.99, lot.completedGrams! / lot.totalGrams! * lot.requiredWork);
      if (lot.completedGrams === lot.totalGrams) lot.completedAt = raw.serverNow;
    } else if (effect.kind === "communication") {
      raw.context.instagramFollowers += effect.instagramFollowers; raw.context.reputation += effect.reputation;
    } else if (effect.kind === "sales") {
      raw.context.shopPartners += effect.shopPartners; raw.context.reputation += effect.reputation;
    } else if (effect.kind === "processing") {
      const batch = raw.context.processingBatches.find(item => item.flowerId === effect.flowerId);
      if (batch) batch.readyAt = new Date(Date.parse(batch.readyAt) - effect.secondsSaved * 1000).toISOString();
    }
  }
}

function commit(raw: ReturnType<typeof fixture>, result: ReturnType<typeof advanceKqStaff>) {
  raw.state = result.state; raw.cashCents -= result.debitCents; applyEffects(raw, result.effects);
  return result;
}
function command(raw: ReturnType<typeof fixture>, value: KqStaffCommand, id = "manual-command") {
  return commit(raw, applyKqStaffCommand(raw, value, id));
}
function configure(raw: ReturnType<typeof fixture>, template: KqStaffPlannedTask[][], enabled = true) {
  return command(raw, { action: "set-weekly-plan", employeeId, enabled, days: template, expectedWeeklyCostCents: getKqStaffWeeklyCost(template) }, "save-plan");
}
function advance(raw: ReturnType<typeof fixture>, day: number, hour = 0) {
  raw.serverNow = dayAt(day, hour);
  return commit(raw, advanceKqStaff(raw));
}
function catchUp(raw: ReturnType<typeof fixture>, day: number, hour = 0) {
  let calls = 0;
  do {
    advance(raw, day, hour);
    if (++calls > 40) throw new Error("Weekly catch-up did not converge");
  } while (hasDueKqStaffWeeklyWork(raw));
  return calls;
}
const plannedTasks = (raw: ReturnType<typeof fixture>) => raw.state.tasks.filter(task => task.weeklyPlanAt);
const history = (raw: ReturnType<typeof fixture>, day: number) => raw.state.employees[0].weeklyPlan!.history.find(entry => entry.day === day);

describe("weekly template validation and prices", () => {
  it("quotes only training and travel, independently of salary and untrusted client prices", () => {
    const trip = KQ_STAFF_CITIES.find(city => city.id === "brest")!.travelCents;
    expect(getKqStaffPlannedTaskCost(training())).toBe(7000);
    expect(getKqStaffPlannedTaskCost(sales())).toBe(trip);
    expect(getKqStaffPlannedTaskCost({ ...communication(), costCents: 999999 })).toBe(0);
    expect(getKqStaffWeeklyCost(days([0, [training(), sales()]], [1, [communication()]]))).toBe(7000 + trip);
    const raw = fixture(), cash = raw.cashCents;
    configure(raw, days([1, [{ ...training(), costCents: 1 }]]));
    expect(raw.cashCents).toBe(cash);
    expect(raw.state.employees[0].weeklyPlan).toMatchObject({ weeklyCostCents: 7000, days: [[], [{ kind: "training", costCents: 7000 }], [], [], []] });
  });

  it("parses a complete five-day template without carrying client price metadata", () => {
    const input = days([1, [{ ...training(), costCents: 1 }, { kind: "culture", hours: 1 }]]);
    const parsed = parseKqStaffWeeklyDays(input);
    expect(parsed[1][0].costCents).not.toBe(1);
    expect(parsed[1][1]).toMatchObject({ kind: "culture", hours: 1 });
    expect(input[1][0].costCents).toBe(1);
  });

  it.each([
    ["missing week", null], ["four days", [[], [], [], []]], ["six days", [[], [], [], [], [], []]],
    ["four slots", days([0, Array.from({ length: 4 }, () => communication())])],
    ["unknown activity", [[{ kind: "unknown", hours: 1 }], [], [], [], []]],
    ["fractional slot", days([0, [communication(0.7)]])], ["zero hours", days([0, [communication(0)]])],
    ["unbounded hours", days([0, [communication(Infinity)]])],
    ["missing training skill", days([0, [{ kind: "training", hours: 2 }]])],
    ["unknown city", days([0, [{ kind: "sales", hours: 2, cityId: "unknown" }]])],
    ["missing trim mode", days([0, [{ kind: "trim", hours: 1 }]])],
  ])("rejects %s", (_name, value) => {
    expect(() => parseKqStaffWeeklyDays(value)).toThrow();
  });

  it("rejects non-contractual days and more than seven daily hours, including approved overtime", () => {
    const raw = fixture(14), employee = raw.state.employees[0];
    expect(() => validateKqStaffWeeklyDays(days([2, [communication()]]), employee)).toThrow();
    employee.workDays["1"] = { usedHours: 0, extraHours: 3 };
    expect(() => validateKqStaffWeeklyDays(days([0, [communication(4), communication(4)]]), employee)).toThrow();
    expect(() => validateKqStaffWeeklyDays(days([0, [communication(7)]], [1, [communication(7)]]), employee)).not.toThrow();
  });

  it("requires an actual activity to activate and the reviewed weekly price", () => {
    const raw = fixture();
    expect(() => configure(raw, days())).toThrow();
    expect(() => command(raw, { action: "set-weekly-plan", employeeId, enabled: true, days: days([1, [training()]]), expectedWeeklyCostCents: 1 })).toThrow();
    expect(() => configure(raw, days(), false)).not.toThrow();
    expect(parseKqStaffCommand({ action: "set-weekly-plan", employeeId, enabled: false, days: days(), expectedWeeklyCostCents: 0 })).toMatchObject({ action: "set-weekly-plan", enabled: false });
  });
});

describe("weekly scheduling and actual task settlement", () => {
  it("starts next day without charging or reserving the current day", () => {
    const raw = fixture(), cash = raw.cashCents;
    configure(raw, days([0, [training()]], [1, [communication(2)]]));
    expect(raw.state.employees[0].weeklyPlan).toMatchObject({ enabled: true, nextDay: 2, updatedAt: dayAt(1) });
    expect(raw.state.tasks).toEqual([]); expect(raw.state.employees[0].workDays).toEqual({}); expect(raw.cashCents).toBe(cash);
    advance(raw, 1, 23); expect(raw.state.tasks).toEqual([]);
    advance(raw, 2); expect(plannedTasks(raw)).toHaveLength(1);
    expect(plannedTasks(raw)[0]).toMatchObject({ kind: "communication", day: 2, hours: 2, status: "running", weeklySlot: 0, weeklyCostCents: 0 });
    expect(raw.state.employees[0].skills.communication).toBe(0);
    advance(raw, 2, 3); expect(raw.state.employees[0].skills.communication).toBe(30);
  });

  it("repeats the same weekday with new stable occurrences and real XP only once", () => {
    const raw = fixture(); configure(raw, days([1, [communication(2)]]));
    const twin = structuredClone(raw);
    advance(raw, 2); advance(twin, 2);
    expect(plannedTasks(raw)[0].id).toBe(plannedTasks(twin)[0].id);
    advance(raw, 2, 3); catchUp(raw, 9, 3);
    expect(plannedTasks(raw).map(task => task.day)).toEqual([2, 9]);
    expect(new Set(plannedTasks(raw).map(task => task.id)).size).toBe(2);
    expect(raw.state.employees[0].skills.communication).toBe(60);
    const before = structuredClone(raw);
    const repeat = advance(raw, 9, 3);
    expect(repeat.debitCents).toBe(0); expect(repeat.effects).toEqual([]); expect(raw).toEqual(before);
  });

  it("queues daily slots in order without overlapping or double-reserving their hours", () => {
    const raw = fixture(); configure(raw, days([1, [communication(1), training(2), { kind: "administration", hours: 1 }]]));
    advance(raw, 2);
    const tasks = plannedTasks(raw);
    expect(tasks.map(task => task.weeklySlot)).toEqual([0, 1, 2]);
    expect(tasks.slice(1).every((task, index) => Date.parse(task.startedAt) >= Date.parse(tasks[index].completesAt))).toBe(true);
    expect(raw.state.employees[0].workDays["2"].usedHours).toBe(4);
    advance(raw, 2, 7); expect(raw.state.employees[0].completedTasks).toBe(3);
    expect(raw.state.employees[0].skills.processing).toBe(150);
  });

  it("changing or pausing the template preserves already reserved work", () => {
    const raw = fixture(); configure(raw, days([1, [communication(2)]])); advance(raw, 2);
    const task = structuredClone(plannedTasks(raw)[0]);
    configure(raw, days([1, [communication(1)]]), false);
    expect(plannedTasks(raw)[0]).toEqual(task);
    expect(raw.state.employees[0].weeklyPlan).toMatchObject({ enabled: false, nextDay: 3 });
    advance(raw, 2, 3); catchUp(raw, 9, 3);
    expect(plannedTasks(raw)).toHaveLength(1); expect(raw.state.employees[0].skills.communication).toBe(30);
    configure(raw, days([1, [communication(1)]]));
    expect(raw.state.employees[0].weeklyPlan!.nextDay).toBe(10);
    expect(plannedTasks(raw)).toHaveLength(1);
  });

  it("manual non-settle commands do not also trigger overdue weekly work", () => {
    const raw = fixture(); configure(raw, days([1, [communication()]]));
    raw.serverNow = dayAt(2);
    command(raw, { action: "buy-trimmer", expectedCostCents: 150000 });
    expect(plannedTasks(raw)).toEqual([]); expect(hasDueKqStaffWeeklyWork(raw)).toBe(true);
    command(raw, { action: "settle" }); expect(plannedTasks(raw)).toHaveLength(1);
  });
});

describe("weekly execution prerequisites and occurrence costs", () => {
  it("charges each real formation and journey occurrence, never the saved template", () => {
    const raw = fixture(), before = raw.cashCents, cost = 7000 + KQ_STAFF_CITIES.find(city => city.id === "brest")!.travelCents;
    configure(raw, days([1, [training(), sales()]])); expect(raw.cashCents).toBe(before);
    advance(raw, 2); expect(raw.cashCents).toBe(before - cost);
    expect(plannedTasks(raw).map(task => task.weeklyCostCents)).toEqual([7000, cost - 7000]);
    advance(raw, 2); expect(raw.cashCents).toBe(before - cost);
    catchUp(raw, 9, 8); expect(raw.cashCents).toBe(before - cost * 2);
  });

  it("records an unaffordable occurrence without charging or consuming its hours", () => {
    const raw = fixture(); configure(raw, days([1, [training()]])); raw.cashCents = 6999;
    advance(raw, 2); expect(raw.cashCents).toBe(6999); expect(plannedTasks(raw)).toEqual([]);
    expect(raw.state.employees[0].workDays["2"]?.usedHours ?? 0).toBe(0);
    expect(history(raw, 2)).toMatchObject({ started: 0, skipped: 1 });
    expect(history(raw, 2)?.reasons.join(" ")).toMatch(/trésorerie|budget|insuffisant/i);
  });

  it("keeps later free slots available when a paid occurrence exceeds the remaining budget", () => {
    const raw = fixture(); configure(raw, days([1, [training(), sales(), communication()]])); raw.cashCents = 10000;
    advance(raw, 2);
    expect(plannedTasks(raw).map(task => task.kind)).toEqual(["training", "communication"]);
    expect(raw.cashCents).toBe(3000); expect(raw.state.employees[0].workDays["2"].usedHours).toBe(3);
    expect(history(raw, 2)).toMatchObject({ started: 2, skipped: 1 });
  });

  it("does not bill training at the maximum level", () => {
    const raw = fixture(); configure(raw, days([1, [training()]])); raw.state.employees[0].skills.processing = 8100;
    const before = raw.cashCents; advance(raw, 2);
    expect(plannedTasks(raw)).toEqual([]); expect(raw.cashCents).toBe(before);
    expect(history(raw, 2)?.reasons.join(" ")).toMatch(/niveau|maxim/i);
  });

  it("skips paid leave with a visible reason and no formation fee", () => {
    const raw = fixture(); configure(raw, days([1, [training()]]));
    raw.state.employees[0].leave = [{ id: "approved-leave", startDay: 2, endDay: 2, days: 1 }];
    const before = raw.cashCents; advance(raw, 2);
    expect(plannedTasks(raw)).toEqual([]); expect(raw.cashCents).toBe(before);
    expect(history(raw, 2)?.reasons.join(" ")).toMatch(/congé/i);
  });

  it("honours part-time days and weekend rest over repeated weeks", () => {
    const raw = fixture(14); configure(raw, days([0, [communication()]], [1, [communication()]]));
    catchUp(raw, 9, 2);
    expect(plannedTasks(raw).map(task => task.day)).toEqual([2, 8, 9]);
    expect(plannedTasks(raw).every(task => (task.day - 1) % 7 < 2)).toBe(true);
  });

  it("blocks unpaid payroll and resumes a later occurrence only after an explicit payroll payment", () => {
    const raw = fixture(); configure(raw, days([1, [training()]]));
    raw.state.payroll.push({ id: "unpaid", employeeId, dueAt: dayAt(2), grossCents: 10000, employerCents: 3500, indemnityCents: 0, totalCents: 13500, paidCents: 0 });
    const cash = raw.cashCents; advance(raw, 2);
    expect(raw.cashCents).toBe(cash); expect(plannedTasks(raw)).toEqual([]);
    expect(history(raw, 2)?.reasons.join(" ")).toMatch(/salair|paie/i);
    command(raw, { action: "payroll", expectedCents: 13500 });
    expect(raw.cashCents).toBe(cash - 13500); expect(plannedTasks(raw)).toEqual([]);
    catchUp(raw, 9); expect(plannedTasks(raw)).toHaveLength(1); expect(plannedTasks(raw)[0].day).toBe(9);
    expect(raw.cashCents).toBe(cash - 13500 - 7000);
  });

  it("never starts work after the employee contract has ended", () => {
    const raw = fixture(); configure(raw, days([1, [training()]]));
    raw.state.employees[0].endsAt = dayAt(2);
    const cash = raw.cashCents; advance(raw, 2);
    expect(plannedTasks(raw)).toEqual([]); expect(raw.cashCents).toBe(cash); expect(raw.state.employees[0].status).toBe("ended");
  });
});

describe("weekly targets, shared trim and bounded catch-up", () => {
  it("records a disappeared fixed culture rather than substituting another target", () => {
    const raw = fixture(); configure(raw, days([1, [{ kind: "culture", hours: 1, targetId: "culture-1" }]]));
    raw.context.activeRuns = [{ id: "different", name: "Autre culture", startedAt: dayAt(1) }];
    advance(raw, 2); expect(plannedTasks(raw)).toEqual([]);
    expect(history(raw, 2)).toMatchObject({ started: 0, skipped: 1 }); expect(history(raw, 2)?.reasons.length).toBeGreaterThan(0);
  });

  it("automatic targets exclude cultures that did not yet exist on the occurrence day", () => {
    const raw = fixture(); configure(raw, days([1, [{ kind: "culture", hours: 1 }]], [2, [{ kind: "culture", hours: 1 }]]));
    raw.context.activeRuns[0].startedAt = dayAt(3);
    catchUp(raw, 3, 2);
    expect(plannedTasks(raw).map(task => ({ day: task.day, targetId: task.targetId }))).toEqual([{ day: 3, targetId: "culture-1" }]);
    expect(history(raw, 2)?.skipped).toBe(1);
  });

  it("skips processing if the target will be ready before the task ends", () => {
    const raw = fixture(); configure(raw, days([1, [{ kind: "processing", hours: 2 }]]));
    raw.context.processingBatches[0].readyAt = dayAt(2, 1);
    advance(raw, 2); expect(plannedTasks(raw)).toEqual([]); expect(history(raw, 2)?.skipped).toBe(1);
  });

  it("creates real shared trim shifts and credits only available grams", () => {
    const raw = fixture(); configure(raw, days([1, [{ kind: "trim", hours: 1, trimMode: "manual" }]]));
    raw.context.trimLots![0].totalGrams = 30;
    advance(raw, 2);
    expect(plannedTasks(raw)[0]).toMatchObject({ kind: "trim", trimQueue: true, trimRateGramsPerHour: 60, trimGrams: 0, weeklyCostCents: 0 });
    expect(plannedTasks(raw)[0].targetId).toBeUndefined();
    advance(raw, 2, 1); expect(raw.context.trimLots![0].completedGrams).toBe(30); expect(plannedTasks(raw)[0].trimGrams).toBe(30);
    expect(raw.state.employees[0].workDays["2"].usedHours).toBe(1);
    expect(raw.state.employees[0].skills.processing).toBeGreaterThan(0);
  });

  it("does not buy a missing trimmer for an automatic shift", () => {
    const raw = fixture(); configure(raw, days([1, [{ kind: "trim", hours: 1, trimMode: "machine" }]]));
    const cash = raw.cashCents; advance(raw, 2);
    expect(raw.state.trimmerOwned).toBe(false); expect(raw.cashCents).toBe(cash); expect(plannedTasks(raw)).toEqual([]);
    expect(history(raw, 2)?.reasons.join(" ")).toMatch(/trimeuse|machine/i);
  });

  it("settles the complete pre-payroll backlog in one call with unique occurrences and seven history days", () => {
    const raw = fixture(); configure(raw, days(...Array.from({ length: 5 }, (_, weekday): [number, KqStaffPlannedTask[]] => [weekday, [communication()]])));
    advance(raw, 24, 2);
    expect(raw.state.employees[0].weeklyPlan!.nextDay).toBe(25);
    expect(hasDueKqStaffWeeklyWork(raw)).toBe(false); expect(plannedTasks(raw)).toHaveLength(17);
    const ids = plannedTasks(raw).map(task => task.id); expect(new Set(ids).size).toBe(ids.length);
    expect(plannedTasks(raw).every(task => task.day >= 2 && task.day <= 24 && (task.day - 1) % 7 < 5)).toBe(true);
    expect(raw.state.employees[0].weeklyPlan!.history.length).toBeLessThanOrEqual(7);
    const before = structuredClone(raw); advance(raw, 24, 2); expect(raw).toEqual(before);
  });

  it("bounds a long absence at the first unpaid payroll while moving the plan cursor to the current day", () => {
    const raw = fixture(); configure(raw, days(...Array.from({ length: 5 }, (_, weekday): [number, KqStaffPlannedTask[]] => [weekday, [communication()]])));
    advance(raw, 365, 2);
    expect(plannedTasks(raw).length).toBeGreaterThan(0); expect(plannedTasks(raw).length).toBeLessThanOrEqual(66);
    expect(plannedTasks(raw).every(task => task.day < 31)).toBe(true);
    expect(raw.state.payroll.some(pay => pay.paidCents < pay.totalCents)).toBe(true);
    expect(raw.state.employees[0].weeklyPlan!.nextDay).toBe(366); expect(hasDueKqStaffWeeklyWork(raw)).toBe(false);
    expect(raw.state.employees[0].weeklyPlan!.history.length).toBeLessThanOrEqual(7);
    const before = structuredClone(raw); advance(raw, 365, 2); expect(raw).toEqual(before);
  });
});
