import { describe, expect, it } from "vitest";
import { KQ_GAME_DAY_MS, KQ_GAME_MONTH_MS } from "./kanab-quest-business";
import {
  advanceKqStaff, applyKqStaffCommand, createKqStaffState, getKqStaffCalendar,
  getKqStaffCapacity, getKqStaffExtraQuote, getKqStaffLeave, getKqStaffLevel,
  getKqStaffMonthlyCost, getKqStaffProspectChance, getKqStaffTrainingCost,
  isKqStaffState, KQ_STAFF_CANDIDATES, KQ_STAFF_CITIES, parseKqStaffCommand, projectKqStaffSnapshot,
  type KqStaffCommand, type KqStaffContractKind, type KqStaffEmployee,
  type KqStaffRawSnapshot, type KqStaffState,
} from "./kanab-quest-staff";

// Calendar intentionally starts across a real-world daylight-saving transition.
const START = Date.parse("2026-10-24T22:00:00Z");
const iso = (time: number) => new Date(time).toISOString();
const dayAt = (day: number, hour = 0) => iso(START + (day - 1 + hour / 24) * KQ_GAME_DAY_MS);
const monthAt = (month: number) => iso(START + month * KQ_GAME_MONTH_MS);

function snapshot(state: KqStaffState | null = null, serverNow = dayAt(1)): KqStaffRawSnapshot {
  return {
    state, revision: 0, serverNow, cashCents: 10_000_000,
    context: {
      businessStartedAt: dayAt(1), reputation: 0, instagramFollowers: 0, shopPartners: 0,
      activeRuns: [{ id: "run-1", name: "Culture en cours" }],
      processingBatches: [{ id: "batch-1", flowerId: "flower-1", name: "Lot en cours", startedAt: dayAt(1), readyAt: dayAt(10) }],
      supplierInvoices: [{ id: "invoice-1", remainingCents: 1000, dueAt: dayAt(5) }],
    },
  };
}

function hireCommand(code = "anna", hours = 35, contract: KqStaffContractKind = "cdi", months = 0): KqStaffCommand {
  const candidate = KQ_STAFF_CANDIDATES.find(item => item.code === code)!;
  return {
    action: "hire", candidateCode: code, weeklyHours: hours, contract, durationMonths: months,
    reason: contract === "cdi" ? "permanent" : contract === "seasonal" ? "harvest" : "temporary-increase",
    expectedMonthlyCostCents: getKqStaffMonthlyCost(candidate, hours).totalCents,
  };
}

function hired(hours = 35, code = "anna", contract: KqStaffContractKind = "cdi", months = 0) {
  return applyKqStaffCommand(snapshot(), hireCommand(code, hours, contract, months), "employee-1").state;
}

function employee(hours = 35): KqStaffEmployee { return hired(hours).employees[0]; }
function calendar(day: number) { return getKqStaffCalendar(dayAt(1), dayAt(day)); }
function assign(state: KqStaffState, kind: "culture" | "processing" | "communication", hours: number, id: string) {
  return applyKqStaffCommand(snapshot(state), {
    action: "assign", employeeId: "employee-1", kind, hours,
    ...(kind === "culture" ? { targetId: "run-1" } : kind === "processing" ? { targetId: "flower-1" } : {}),
  }, id);
}

function trimSnapshot(state: KqStaffState | null = null, serverNow = dayAt(1)): KqStaffRawSnapshot {
  const raw = snapshot(state, serverNow);
  raw.context.trimLots = [{ flowerId: "trim-1", name: "Récolte brute", requiredWork: 6, completedWork: 0, mode: null, completedAt: null }];
  return raw;
}

function trimCommand(hours = 2, employeeId: string | null = null, mode: "manual" | "machine" = "manual"): Extract<KqStaffCommand, { action: "trim" }> {
  return { action: "trim", employeeId, flowerId: "trim-1", mode, hours, expectedCostCents: 0 };
}

describe("staff contracts and the shared business calendar", () => {
  it("uses elapsed game days and a shared Monday origin, including weekend boundaries", () => {
    expect(getKqStaffCalendar(dayAt(1), dayAt(1))).toMatchObject({ day: 1, week: 0, weekday: 0, weekend: false });
    expect(getKqStaffCalendar(dayAt(1), dayAt(6))).toMatchObject({ day: 6, week: 0, weekday: 5, weekend: true });
    expect(getKqStaffCalendar(dayAt(1), dayAt(7))).toMatchObject({ day: 7, week: 0, weekday: 6, weekend: true });
    expect(getKqStaffCalendar(dayAt(1), dayAt(8))).toMatchObject({ day: 8, week: 1, weekday: 0, weekend: false });
    const result = applyKqStaffCommand(snapshot(null, dayAt(6)), hireCommand(), "late-hire");
    expect(getKqStaffCapacity(result.state.employees[0], calendar(6)).remainingHours).toBe(0);
    expect(getKqStaffCapacity(result.state.employees[0], calendar(8)).remainingHours).toBe(7);
  });

  it.each([7, 14, 21, 28, 35])("provides exactly %i contractual hours per week, with no weekend work", hours => {
    const member = employee(hours);
    const capacities = Array.from({ length: 7 }, (_, index) => getKqStaffCapacity(member, calendar(index + 1)).baseHours);
    expect(capacities.reduce((sum, value) => sum + value, 0)).toBe(hours);
    expect(capacities.slice(5)).toEqual([0, 0]);
    expect(() => getKqStaffExtraQuote(member, calendar(6), 1)).toThrow();
  });

  it("requires the offered price, valid temporary grounds and full-time CDI for a chief grower", () => {
    expect(() => applyKqStaffCommand(snapshot(), { ...hireCommand(), expectedMonthlyCostCents: 1 } as KqStaffCommand, "x")).toThrow();
    expect(() => applyKqStaffCommand(snapshot(), { ...hireCommand("anna", 35, "cdd", 3), reason: "permanent" } as KqStaffCommand, "x")).toThrow();
    expect(() => applyKqStaffCommand(snapshot(), hireCommand("samira", 7), "x")).toThrow();
    expect(() => applyKqStaffCommand(snapshot(), hireCommand("samira", 35, "cdd", 3), "x")).toThrow();
    const state = applyKqStaffCommand(snapshot(), hireCommand("samira"), "chief").state;
    expect(state.employees[0]).toMatchObject({ role: "grower", contract: "cdi", weeklyHours: 35, endsAt: null });
    expect(() => applyKqStaffCommand(snapshot(state), hireCommand("samira"), "duplicate")).toThrow();
  });
});

describe("staff extra hours", () => {
  it("splits complementary hours at the tenth and rejects the third-of-contract limit", () => {
    const member = employee(14);
    // First 1.4 hours at +10%; remaining 0.6 hour at +25%.
    expect(getKqStaffExtraQuote(member, calendar(1), 2)).toBe(2819);
    member.workDays["1"] = { usedHours: 0, extraHours: 3 };
    expect(getKqStaffExtraQuote(member, calendar(2), 1.5)).toBe(2308);
    expect(() => getKqStaffExtraQuote(member, calendar(2), 2)).toThrow(/tiers/);
    const nearlyFullTime = employee(28);
    nearlyFullTime.workDays["1"] = { usedHours: 0, extraHours: 3 };
    nearlyFullTime.workDays["2"] = { usedHours: 0, extraHours: 3 };
    expect(() => getKqStaffExtraQuote(nearlyFullTime, calendar(3), 1)).toThrow(/35/);
  });

  it("splits overtime at eight hours, caps the day and the week, and resets the weekly premium", () => {
    const member = employee();
    member.workDays = { "1": { usedHours: 0, extraHours: 3 }, "2": { usedHours: 0, extraHours: 3 }, "3": { usedHours: 0, extraHours: 1 } };
    expect(getKqStaffExtraQuote(member, calendar(4), 2)).toBe(3385); // 1 hour +25%, then 1 hour +50%.
    expect(() => getKqStaffExtraQuote(member, calendar(1), 0.5)).toThrow(/10 heures/);
    expect(getKqStaffExtraQuote(member, calendar(8), 2)).toBe(3078);
    member.workDays["3"].extraHours = 3;
    member.workDays["4"] = { usedHours: 0, extraHours: 3 };
    expect(getKqStaffExtraQuote(member, calendar(5), 1)).toBe(1847);
    expect(() => getKqStaffExtraQuote(member, calendar(5), 1.5)).toThrow(/48/);
  });

  it("enforces the rolling twelve-week average independently of the current week cap", () => {
    const member = employee();
    for (let week = 0; week < 11; week++) {
      for (let weekday = 0; weekday < 3; weekday++) member.workDays[String(week * 7 + weekday + 1)] = { usedHours: 0, extraHours: 3 };
    }
    for (let weekday = 0; weekday < 3; weekday++) member.workDays[String(78 + weekday)] = { usedHours: 0, extraHours: 3 };
    expect(() => getKqStaffExtraQuote(member, calendar(81), 0.5)).toThrow(/44 h/);
  });

  it("bills approved additional hours once even when they are not used for missions", () => {
    const state = hired();
    const quote = getKqStaffExtraQuote(state.employees[0], calendar(1), 2);
    const extra = applyKqStaffCommand(snapshot(state), { action: "extra-hours", employeeId: "employee-1", hours: 2, expectedGrossCents: quote }, "extra");
    expect(extra.debitCents).toBe(0);
    expect(extra.state.employees[0].overtimeGrossCents).toBe(quote);
    const month = advanceKqStaff(snapshot(extra.state, monthAt(1))).state;
    expect(month.payroll[0].grossCents).toBe(186702 + quote);
    expect(month.employees[0].overtimeGrossCents).toBe(0);
    expect(advanceKqStaff(snapshot(month, monthAt(1))).state.payroll).toEqual(month.payroll);
  });
});

describe("staff missions, learning and prospecting", () => {
  it("shares one daily capacity across tasks and applies each queued completion only once", () => {
    const initial = hired();
    const first = assign(initial, "culture", 4, "care");
    const second = assign(first.state, "processing", 3, "process");
    expect(initial.tasks).toEqual([]);
    expect(second.state.tasks[1].startedAt).toBe(second.state.tasks[0].completesAt);
    expect(getKqStaffCapacity(second.state.employees[0], calendar(1)).remainingHours).toBe(0);
    expect(() => assign(second.state, "communication", 0.5, "too-much")).toThrow();
    expect(advanceKqStaff(snapshot(second.state, iso(Date.parse(second.state.tasks[0].completesAt) - 1))).effects).toEqual([]);
    const finished = advanceKqStaff(snapshot(second.state, second.state.tasks[1].completesAt));
    expect(finished.effects.map(item => item.kind)).toEqual(["culture", "processing"]);
    expect(finished.state.employees[0]).toMatchObject({ completedTasks: 2, skills: { culture: 60, processing: 45 } });
    const again = advanceKqStaff(snapshot(finished.state, second.state.tasks[1].completesAt));
    expect(again.effects).toEqual([]);
    expect(again.state.employees[0].skills).toEqual(finished.state.employees[0].skills);
  });

  it("withholds effects when the targeted culture or processing batch has ended", () => {
    const state = assign(hired(), "culture", 2, "care").state;
    const raw = snapshot(state, state.tasks[0].completesAt);
    raw.context.activeRuns = [];
    const done = advanceKqStaff(raw);
    expect(done.effects).toEqual([]);
    expect(done.state.tasks[0].status).toBe("completed");
    expect(done.state.employees[0].skills.culture).toBeGreaterThan(0);
    const processing = assign(hired(), "processing", 2, "processing").state;
    expect(advanceKqStaff(snapshot(processing, dayAt(11))).effects).toEqual([]);
  });

  it("rejects tasks crossing the current game day and leaves input unchanged on failure", () => {
    const state = hired();
    const original = structuredClone(state);
    expect(() => applyKqStaffCommand(snapshot(state, dayAt(1, 23)), { action: "assign", employeeId: "employee-1", kind: "communication", hours: 2 }, "late")).toThrow();
    expect(state).toEqual(original);
  });

  it("charges training, uses planning time and raises a skill only upon completion", () => {
    const state = hired();
    const command: KqStaffCommand = { action: "train", employeeId: "employee-1", skill: "processing", hours: 2, expectedCostCents: 7000 };
    expect(getKqStaffTrainingCost(2)).toBe(7000);
    const result = applyKqStaffCommand(snapshot(state), command, "training");
    expect(result.debitCents).toBe(7000);
    expect(result.state.employees[0].skills.processing).toBe(0);
    expect(getKqStaffCapacity(result.state.employees[0], calendar(1)).remainingHours).toBe(5);
    const done = advanceKqStaff(snapshot(result.state, result.state.tasks[0].completesAt));
    expect(done.effects).toEqual([]);
    expect(done.state.employees[0].skills.processing).toBe(150);
    expect(getKqStaffLevel(done.state.employees[0].skills.processing)).toBe(2);
    const poor = { ...snapshot(state), cashCents: 6999 };
    expect(() => applyKqStaffCommand(poor, command, "unfunded")).toThrow();
    expect(state.employees[0].skills.processing).toBe(0);
    state.employees[0].skills.processing = 8100;
    expect(() => applyKqStaffCommand(snapshot(state), command, "maxed")).toThrow(/maximal/);
  });

  it("lets a quick trait shorten completion without creating extra planning hours", () => {
    const state = hired(35, "nora");
    const result = assign(state, "processing", 7, "fast");
    expect(Date.parse(result.state.tasks[0].completesAt) - START).toBeLessThan(7 * KQ_GAME_DAY_MS / 24);
    expect(getKqStaffCapacity(result.state.employees[0], calendar(1)).remainingHours).toBe(0);
  });

  it("makes prospecting depend on skill, reputation and followers, with a capped chance", () => {
    const base = getKqStaffProspectChance(1, 0, 0);
    expect(getKqStaffProspectChance(5, 0, 0)).toBeGreaterThan(base);
    expect(getKqStaffProspectChance(1, 1000, 0)).toBeGreaterThan(base);
    expect(getKqStaffProspectChance(1, 0, 1000)).toBeGreaterThan(base);
    expect(getKqStaffProspectChance(1, 0, 0, true)).toBe(base + 8);
    expect(getKqStaffProspectChance(10, 1_000_000, 1_000_000, true)).toBe(90);
    expect(getKqStaffProspectChance(1, -100, -100)).toBe(base);
    const raw = snapshot(hired(35, "ines"));
    raw.context.reputation = 1000; raw.context.instagramFollowers = 2000;
    const trip = applyKqStaffCommand(raw, { action: "assign", employeeId: "employee-1", kind: "sales", hours: 2, cityId: "rennes", expectedCostCents: 4500 }, "prospect");
    expect(trip.debitCents).toBe(4500);
    expect(trip.state.tasks[0].successChance).toBeGreaterThan(getKqStaffProspectChance(5, 1000, 2000, true));
    expect(() => applyKqStaffCommand(raw, { action: "assign", employeeId: "employee-1", kind: "sales", hours: 2, cityId: "rennes", expectedCostCents: 4499 }, "stale-travel-budget")).toThrow();
    expect(() => applyKqStaffCommand(raw, { action: "assign", employeeId: "employee-1", kind: "sales", hours: 2, cityId: "unknown" }, "bad-city")).toThrow();
  });

  it.each([19, 20, 100, 125])("settles every successful visit above %i partners, without exhausting a city or replaying gains", partners => {
    let state = hired(35, "ines");
    state = applyKqStaffCommand(snapshot(state), hireCommand("hugo"), "employee-2").state;
    state.prospecting.rennes = 42;
    let raw = snapshot(state); raw.context.shopPartners = partners;
    state = applyKqStaffCommand(raw, { action: "assign", employeeId: "employee-1", kind: "sales", hours: 2, cityId: "rennes", expectedCostCents: 4500 }, "prospect-1").state;
    raw = snapshot(state); raw.context.shopPartners = partners;
    state = applyKqStaffCommand(raw, { action: "assign", employeeId: "employee-2", kind: "sales", hours: 2, cityId: "rennes", expectedCostCents: 4500 }, "prospect-2").state;
    for (const task of state.tasks) task.successChance = 100;
    raw = snapshot(state, iso(Math.max(...state.tasks.map(task => Date.parse(task.completesAt))))); raw.context.shopPartners = partners;
    const result = advanceKqStaff(raw);
    expect(result.effects.filter(effect => effect.kind === "sales")).toEqual([{ kind: "sales", shopPartners: 1, reputation: 5 }, { kind: "sales", shopPartners: 1, reputation: 5 }]);
    expect(result.state.prospecting.rennes).toBe(44);
    expect(result.state.tasks.every(task => task.status === "completed" && task.outcome?.includes("recrutée à Rennes"))).toBe(true);
    const again = advanceKqStaff({ ...raw, state: result.state, context: { ...raw.context, shopPartners: partners + 2 } });
    expect(again.effects).toEqual([]); expect(again.state.prospecting.rennes).toBe(44);

    const nextDay = snapshot(result.state, dayAt(2)); nextDay.context.shopPartners = partners + 2;
    const returnTrip = applyKqStaffCommand(nextDay, { action: "assign", employeeId: "employee-1", kind: "sales", hours: 2, cityId: "rennes", expectedCostCents: 4500 }, "return-to-rennes");
    expect(returnTrip.debitCents).toBe(4500);
    const nextTask = returnTrip.state.tasks.find(task => task.id === "return-to-rennes")!; nextTask.successChance = 100;
    const returned = advanceKqStaff({ ...nextDay, state: returnTrip.state, serverNow: nextTask.completesAt });
    expect(returned.effects).toEqual([{ kind: "sales", shopPartners: 1, reputation: 5 }]);
    expect(returned.state.prospecting.rennes).toBe(45);
  });

  it.each(KQ_STAFF_CITIES)("keeps $name available with a positive local chance after repeated visits", city => {
    const firstRaw = snapshot(hired());
    const command: KqStaffCommand = { action: "assign", employeeId: "employee-1", kind: "sales", hours: 2, cityId: city.id, expectedCostCents: city.travelCents };
    const first = applyKqStaffCommand(firstRaw, command, "first-trip");
    const experiencedNetwork = snapshot(hired()); experiencedNetwork.context.shopPartners = 250;
    experiencedNetwork.state!.prospecting[city.id] = 1000;
    const repeat = applyKqStaffCommand(experiencedNetwork, command, "repeat-trip");
    expect(repeat.state.tasks[0].successChance).toBe(first.state.tasks[0].successChance);
    expect(repeat.state.tasks[0].successChance).toBeGreaterThan(0);
    expect(repeat.state.tasks[0].successChance).toBeLessThanOrEqual(90);
    expect(repeat.debitCents).toBe(city.travelCents);
    expect(repeat.state.prospecting[city.id]).toBe(1000);
  });

  it("uses local activity as a chance bonus, while a failed visit does not invent a partner", () => {
    const firstRaw = snapshot(hired());
    const trip = (cityId: string, expectedCostCents: number) => applyKqStaffCommand(firstRaw, { action: "assign", employeeId: "employee-1", kind: "sales", hours: 2, cityId, expectedCostCents }, cityId);
    const dense = trip("rennes", 4500), quiet = trip("lannion", 3000);
    expect(dense.state.tasks[0].successChance).toBeGreaterThan(quiet.state.tasks[0].successChance!);
    dense.state.tasks[0].successChance = 0;
    const done = advanceKqStaff(snapshot(dense.state, dense.state.tasks[0].completesAt));
    expect(done.effects).toEqual([]);
    expect(done.state.prospecting.rennes).toBeUndefined();
    expect(done.state.tasks[0].outcome).toContain("sans nouveau contrat");
  });

  it("communication adds followers and reputation once, while invoice handling consumes time", () => {
    const result = assign(hired(35, "ines"), "communication", 2, "post");
    const done = advanceKqStaff(snapshot(result.state, result.state.tasks[0].completesAt));
    expect(done.effects).toEqual([{ kind: "communication", instagramFollowers: 53, reputation: 2 }]);
    const invoice = applyKqStaffCommand(snapshot(done.state, result.state.tasks[0].completesAt), { action: "pay-invoice", employeeId: "employee-1", invoiceId: "invoice-1", expectedCents: 1000 }, "payment");
    expect(invoice.effects).toEqual([{ kind: "supplier-payment", invoiceId: "invoice-1", amountCents: 1000 }]);
    expect(invoice.debitCents).toBe(0); // The supplier-payment effect performs the debit in the transaction.
    expect(getKqStaffCapacity(invoice.state.employees[0], calendar(1)).usedHours).toBe(2.5);
    expect(() => applyKqStaffCommand(snapshot(done.state, result.state.tasks[0].completesAt), { action: "pay-invoice", employeeId: "employee-1", invoiceId: "invoice-1", expectedCents: 999 }, "stale")).toThrow();
  });
});

describe("staff salary and paid leave accounting", () => {
  it("accrues full contractual salary without missions, then debits only an explicit exact payment", () => {
    const state = hired();
    expect(getKqStaffMonthlyCost(state.employees[0], 35)).toEqual({ grossCents: 186702, employerCents: 65346, totalCents: 252048 });
    expect(advanceKqStaff(snapshot(state, iso(START + KQ_GAME_MONTH_MS - 1))).state.payroll).toEqual([]);
    const accrued = advanceKqStaff(snapshot(state, monthAt(2))).state;
    expect(accrued.tasks).toEqual([]);
    expect(accrued.payroll).toHaveLength(2);
    for (const [index, bill] of accrued.payroll.entries()) {
      expect(bill).toMatchObject({ dueAt: monthAt(index + 1), grossCents: 186702, employerCents: 65346, totalCents: 252048, paidCents: 0 });
    }
    const raw = snapshot(accrued, monthAt(2));
    expect(projectKqStaffSnapshot(raw).outstandingCents).toBe(504096);
    expect(() => applyKqStaffCommand(raw, { action: "assign", employeeId: "employee-1", kind: "communication", hours: 1 }, "blocked")).toThrow(/salaires/);
    expect(() => applyKqStaffCommand(raw, { action: "payroll", expectedCents: 504095 }, "stale")).toThrow();
    expect(() => applyKqStaffCommand({ ...raw, cashCents: 1 }, { action: "payroll", expectedCents: 504096 }, "poor")).toThrow();
    const paid = applyKqStaffCommand(raw, { action: "payroll", expectedCents: 504096 }, "pay");
    expect(paid.debitCents).toBe(504096);
    expect(projectKqStaffSnapshot(snapshot(paid.state, monthAt(2))).outstandingCents).toBe(0);
    expect(advanceKqStaff(snapshot(paid.state, monthAt(2))).state.payroll).toEqual(paid.state.payroll);
  });

  it("acquires the same leave duration at full and part time, prorated for elapsed employment", () => {
    for (const hours of [7, 35]) {
      const member = employee(hours);
      expect(getKqStaffLeave(member, dayAt(1)).earnedDays).toBe(0);
      expect(getKqStaffLeave(member, monthAt(3)).earnedDays).toBe(6.25);
      expect(getKqStaffLeave(member, monthAt(12)).earnedDays).toBe(25);
    }
  });

  it("removes capacity during leave, skips weekend debits and keeps contractual pay", () => {
    const state = hired();
    const scheduled = applyKqStaffCommand(snapshot(state, monthAt(3)), { action: "leave", employeeId: "employee-1", startDay: 92, endDay: 96 }, "holiday").state;
    expect(scheduled.employees[0].leave[0].days).toBe(5);
    expect(getKqStaffCapacity(scheduled.employees[0], calendar(92)).remainingHours).toBe(0);
    expect(getKqStaffCapacity(scheduled.employees[0], calendar(97)).remainingHours).toBe(0);
    expect(getKqStaffCapacity(scheduled.employees[0], calendar(99)).remainingHours).toBe(7);
    expect(getKqStaffLeave(scheduled.employees[0], monthAt(3)).availableDays).toBe(1.25);
    const paidMonth = advanceKqStaff(snapshot(scheduled, monthAt(4))).state;
    expect(paidMonth.payroll.at(-1)?.grossCents).toBe(186702);
    expect(() => applyKqStaffCommand(snapshot(state, monthAt(3)), { action: "leave", employeeId: "employee-1", startDay: 97, endDay: 98 }, "weekend")).toThrow();
  });

  it("counts leave until the next scheduled return for a worker employed only on Mondays", () => {
    const state = hired(7);
    const scheduled = applyKqStaffCommand(snapshot(state, monthAt(3)), { action: "leave", employeeId: "employee-1", startDay: 92, endDay: 92 }, "holiday").state;
    expect(scheduled.employees[0].leave[0].days).toBe(5);
    expect(getKqStaffCapacity(scheduled.employees[0], calendar(92)).remainingHours).toBe(0);
    expect(getKqStaffCapacity(scheduled.employees[0], calendar(99)).remainingHours).toBe(7);
  });

  it("reserves acquired leave once, rejects overlap and restores only a future cancelled leave", () => {
    const state = hired();
    expect(() => applyKqStaffCommand(snapshot(state), { action: "leave", employeeId: "employee-1", startDay: 2, endDay: 3 }, "too-early")).toThrow(/insuffisant/);
    const raw = snapshot(state, monthAt(3));
    const scheduled = applyKqStaffCommand(raw, { action: "leave", employeeId: "employee-1", startDay: 92, endDay: 93 }, "holiday").state;
    expect(() => applyKqStaffCommand(snapshot(scheduled, monthAt(3)), { action: "leave", employeeId: "employee-1", startDay: 93, endDay: 94 }, "overlap")).toThrow();
    const cancelled = applyKqStaffCommand(snapshot(scheduled, monthAt(3)), { action: "cancel-leave", employeeId: "employee-1", leaveId: "holiday" }, "cancel").state;
    expect(getKqStaffLeave(cancelled.employees[0], monthAt(3)).availableDays).toBe(6.25);
    expect(() => applyKqStaffCommand(snapshot(scheduled, dayAt(92)), { action: "cancel-leave", employeeId: "employee-1", leaveId: "holiday" }, "started")).toThrow();
  });

  it.each([
    { contract: "cdd" as const, months: 3 },
    { contract: "seasonal" as const, months: 2 },
  ])("settles $contract for $months months with the correct untaken-leave and precariousness bases", ({ contract, months }) => {
    const state = hired(35, "anna", contract, months);
    const final = advanceKqStaff(snapshot(state, monthAt(months))).state;
    const gross = 186702 * months;
    const precariousness = contract === "cdd" ? Math.round(gross * 0.1) : 0;
    const holiday = Math.round((gross + precariousness) * 0.1);
    expect(final.payroll.reduce((sum, row) => sum + row.grossCents, 0)).toBe(gross);
    expect(final.payroll.at(-1)?.indemnityCents).toBe(precariousness + holiday);
    expect(final.employees[0].status).toBe("ended");
    expect(getKqStaffCapacity(final.employees[0], calendar(months * 30 + 1)).remainingHours).toBe(0);
    expect(advanceKqStaff(snapshot(final, monthAt(months + 1))).state.payroll).toEqual(final.payroll);
  });

  it("does not compensate already-taken leave a second time at the end of a CDD", () => {
    const state = hired(35, "anna", "cdd", 3);
    const holiday = applyKqStaffCommand(snapshot(state, monthAt(1)), { action: "leave", employeeId: "employee-1", startDay: 32, endDay: 33 }, "taken-leave").state;
    const withoutLeave = advanceKqStaff(snapshot(state, monthAt(3))).state;
    const withLeave = advanceKqStaff(snapshot(holiday, monthAt(3))).state;
    const endIndemnity = withLeave.payroll.at(-1)!.indemnityCents;
    expect(endIndemnity).toBeLessThan(withoutLeave.payroll.at(-1)!.indemnityCents);
    expect(endIndemnity).toBeGreaterThan(Math.round(186702 * 3 * 0.1));
    expect(withLeave.payroll.reduce((sum, row) => sum + row.grossCents, 0)).toBe(186702 * 3);
  });
});

describe("trim lifecycle for the owner and employees", () => {
  it("lets an owner without employees prepare a harvest during the weekend and settles progress once", () => {
    const raw = trimSnapshot(null, dayAt(6));
    const planned = applyKqStaffCommand(raw, trimCommand(), "owner-trim");
    expect(planned.debitCents).toBe(0);
    expect(planned.state.employees).toEqual([]);
    expect(planned.state.tasks[0]).toMatchObject({ employeeId: "player", kind: "trim", skill: "processing", trimMode: "manual", trimWork: 2 });
    expect(planned.state.playerWorkDays["6"].usedHours).toBe(2);
    expect(planned.state.playerProcessingXp).toBe(0);
    expect(() => applyKqStaffCommand(trimSnapshot(planned.state, dayAt(6)), trimCommand(), "duplicate-lot")).toThrow(/déjà en cours/);
    const completeAt = planned.state.tasks[0].completesAt;
    const done = advanceKqStaff(trimSnapshot(planned.state, completeAt));
    expect(done.effects).toEqual([{ kind: "trim-work", flowerId: "trim-1", mode: "manual", work: 2, qualityDelta: 1 }]);
    expect(done.state.playerProcessingXp).toBe(24);
    expect(done.state.payroll).toEqual([]);
    const again = advanceKqStaff(trimSnapshot(done.state, completeAt));
    expect(again.effects).toEqual([]);
    expect(again.state.playerProcessingXp).toBe(24);
  });

  it("includes a pending completion when quoting another mission on the same lot", () => {
    const first = applyKqStaffCommand(trimSnapshot(), trimCommand(), "first-trim");
    const raw = trimSnapshot(first.state, first.state.tasks[0].completesAt);
    // Context still shows zero work; the command settles the first task before quoting the next.
    const second = applyKqStaffCommand(raw, trimCommand(5), "second-trim");
    expect(second.effects).toEqual([{ kind: "trim-work", flowerId: "trim-1", mode: "manual", work: 2, qualityDelta: 1 }]);
    expect(second.state.tasks[1].trimWork).toBe(4);
    expect(second.state.playerWorkDays["1"].usedHours).toBe(7);
    const nextLot = trimSnapshot(second.state, raw.serverNow);
    nextLot.context.trimLots![0].flowerId = "trim-2";
    expect(() => applyKqStaffCommand(nextLot, { ...trimCommand(5.5), flowerId: "trim-2" }, "over-budget")).toThrow(/12 h/);
    const nextDay = trimSnapshot(second.state, dayAt(2));
    nextDay.context.trimLots![0].flowerId = "trim-2";
    const tomorrow = applyKqStaffCommand(nextDay, { ...trimCommand(0.5), flowerId: "trim-2" }, "new-day");
    expect(tomorrow.state.playerWorkDays["2"].usedHours).toBe(0.5);
  });

  it("locks the method even when its first task has only just completed in the current command", () => {
    const state = createKqStaffState(dayAt(1));
    state.trimmerOwned = true;
    const first = applyKqStaffCommand(trimSnapshot(state), trimCommand(), "manual-first");
    expect(() => applyKqStaffCommand(trimSnapshot(first.state, first.state.tasks[0].completesAt), trimCommand(1, null, "machine"), "switch")).toThrow(/mode/);
    const finished = applyKqStaffCommand(trimSnapshot(state), trimCommand(6), "complete-lot");
    expect(() => applyKqStaffCommand(trimSnapshot(finished.state, finished.state.tasks[0].completesAt), trimCommand(0.5), "already-done")).toThrow();
  });

  it("requires one funded machine purchase at the confirmed price and no per-lot machine fee", () => {
    const raw = trimSnapshot();
    expect(() => applyKqStaffCommand(raw, trimCommand(1.5, null, "machine"), "no-machine")).toThrow(/machine/);
    expect(() => applyKqStaffCommand(raw, { action: "buy-trimmer", expectedCostCents: 149999 }, "stale-price")).toThrow();
    expect(() => applyKqStaffCommand({ ...raw, cashCents: 149999 }, { action: "buy-trimmer", expectedCostCents: 150000 }, "unfunded")).toThrow();
    const bought = applyKqStaffCommand(raw, { action: "buy-trimmer", expectedCostCents: 150000 }, "machine");
    expect(bought.debitCents).toBe(150000);
    expect(bought.state.trimmerOwned).toBe(true);
    expect(() => applyKqStaffCommand(trimSnapshot(bought.state), { action: "buy-trimmer", expectedCostCents: 150000 }, "duplicate")).toThrow();
    const machine = applyKqStaffCommand(trimSnapshot(bought.state), trimCommand(1.5, null, "machine"), "machine-trim");
    expect(machine.debitCents).toBe(0);
    expect(machine.state.tasks[0]).toMatchObject({ trimWork: 6, trimQualityDelta: -3 });
    expect(() => applyKqStaffCommand(raw, { ...trimCommand(), expectedCostCents: 1 }, "stale-fee")).toThrow();
  });

  it("shares an employee's contractual capacity and task queue with trimming", () => {
    const first = assign(hired(), "communication", 5, "other-mission").state;
    expect(() => applyKqStaffCommand(trimSnapshot(first), trimCommand(3, "employee-1"), "overbooked")).toThrow();
    const trim = applyKqStaffCommand(trimSnapshot(first), trimCommand(2, "employee-1"), "employee-trim");
    expect(trim.state.tasks[1].startedAt).toBe(first.tasks[0].completesAt);
    expect(getKqStaffCapacity(trim.state.employees[0], calendar(1)).remainingHours).toBe(0);
    expect(trim.state.playerWorkDays).toEqual({});
    const done = advanceKqStaff(trimSnapshot(trim.state, trim.state.tasks[1].completesAt));
    expect(done.state.employees[0].skills.processing).toBe(30);
    expect(done.state.playerProcessingXp).toBe(0);
    expect(done.effects.some(effect => effect.kind === "trim-work")).toBe(true);
  });

  it("keeps employees off trim on weekends and during paid leave", () => {
    expect(() => applyKqStaffCommand(trimSnapshot(hired(), dayAt(6)), trimCommand(1, "employee-1"), "weekend-work")).toThrow(/Repos/);
    const leave = applyKqStaffCommand(snapshot(hired(), monthAt(3)), { action: "leave", employeeId: "employee-1", startDay: 92, endDay: 96 }, "holiday").state;
    const outstanding = projectKqStaffSnapshot(snapshot(leave, monthAt(3))).outstandingCents;
    const paid = applyKqStaffCommand(snapshot(leave, monthAt(3)), { action: "payroll", expectedCents: outstanding }, "pay").state;
    expect(() => applyKqStaffCommand(trimSnapshot(paid, dayAt(92)), trimCommand(1, "employee-1"), "holiday-work")).toThrow(/congés/);
  });
});

describe("durable staff history", () => {
  it("hands every finished row to SQL before compaction when the archive is available", () => {
    const state = hired();
    const task = assign(state, "communication", 1, "completed-task").state.tasks[0];
    state.tasks = Array.from({ length: 210 }, (_, i) => ({ ...task, id: `task-${i}`, status: "completed" }));
    state.payroll = Array.from({ length: 130 }, (_, i) => ({ id: `pay-${i}`, employeeId: "employee-1", dueAt: dayAt(1), grossCents: 100, employerCents: 0, indemnityCents: 0, totalCents: 100, paidCents: 100 }));
    const archived = advanceKqStaff({ ...snapshot(state), archiveCount: 0 }).state;
    expect(archived.tasks).toEqual(state.tasks);
    expect(archived.payroll).toEqual(state.payroll);
    const legacy = advanceKqStaff(snapshot(state)).state;
    expect(legacy.tasks).toHaveLength(200);
    expect(legacy.payroll).toHaveLength(120);
  });

  it("allows recruitment after forty settled contracts while still limiting active staff to eight", () => {
    const state = createKqStaffState(dayAt(1));
    state.employees = Array.from({ length: 40 }, (_, i) => ({ ...employee(), id: `past-${i}`, code: `past-${i}`, status: "ended", finalPaid: true }));
    const result = applyKqStaffCommand({ ...snapshot(state), archiveCount: 0 }, hireCommand(), "new-employee");
    expect(result.state.employees.filter(row => row.status === "active")).toHaveLength(1);
    state.employees.push(...Array.from({ length: 8 }, (_, i) => ({ ...employee(), id: `active-${i}`, code: `active-${i}` })));
    expect(() => applyKqStaffCommand({ ...snapshot(state), archiveCount: 40 }, hireCommand(), "ninth")).toThrow(/huit/);
  });
});

describe("staff command trust boundaries", () => {
  it("whitelists command fields and ignores client-authored salary, experience, clock and effects", () => {
    const legitimate = { action: "assign", employeeId: "employee-1", kind: "communication", hours: 2 };
    expect(parseKqStaffCommand({ ...legitimate, state: { employees: [] }, hourlyCents: 1, skills: { sales: 8100 }, serverNow: monthAt(100), userId: "someone-else", effects: [{ kind: "sales", shopPartners: 20 }] })).toEqual(legitimate);
  });

  it.each(["__proto__", "constructor", "toString"])("rejects inherited object key %s as a skill or contract", key => {
    expect(() => parseKqStaffCommand({ action: "assign", employeeId: "employee-1", kind: key, hours: 2 })).toThrow();
    expect(() => parseKqStaffCommand({ action: "train", employeeId: "employee-1", skill: key, hours: 2, expectedCostCents: 7000 })).toThrow();
    expect(() => parseKqStaffCommand({ ...hireCommand(), contract: key })).toThrow();
  });

  it.each([NaN, Infinity, -1, 0.25, "2", null])("rejects malformed hour input %s", hours => {
    expect(() => parseKqStaffCommand({ action: "assign", employeeId: "employee-1", kind: "culture", hours })).toThrow();
  });

  it("rejects unknown actions, malformed state and a clock moving backwards", () => {
    for (const payload of [null, [], { action: "settle" }, { action: "change-salary" }]) expect(() => parseKqStaffCommand(payload)).toThrow();
    expect(isKqStaffState({})).toBe(false);
    const state = createKqStaffState(monthAt(1));
    expect(() => advanceKqStaff(snapshot(state, dayAt(1)))).toThrow(/Horloge/);
    expect(() => advanceKqStaff(snapshot(hired(), "invalid"))).toThrow(/Horloge/);
  });
});
