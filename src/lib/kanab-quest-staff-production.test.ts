import { describe, expect, it } from "vitest";
import { KQ_STAFF_CANDIDATES } from "./kanab-quest-staff-recruitment";
import { advanceKqStaff, applyKqStaffCommand } from "./kanab-quest-staff";
import { createKqWarehouseStarter, getKqWarehouseQuote } from "./kanab-quest-warehouse";
import { advanceKqStaffProduction, configureKqStaffProduction, getKqProductionCashDelta, getKqProductionFacilities, isKqStaffProductionState, KQ_PRODUCTION_HOUR_MS } from "./kanab-quest-staff-production";
import type { KqProductionLot, KqProductionStep } from "./kanab-quest-staff-production-types";
import type { KqStaffEffect, KqStaffRawSnapshot, KqStaffState, KqStaffTask } from "./kanab-quest-staff-types";

const START = Date.parse("2026-11-02T08:00:00Z");
const hour = (value: number) => new Date(START + value * KQ_PRODUCTION_HOUR_MS).toISOString();
function fixture(area = 1): KqStaffRawSnapshot & { state: KqStaffState } {
  const state: KqStaffState = { version: 1, employees: [], tasks: [], payroll: [], lastSettledAt: hour(0),
    supplierDiscountPercent: 0, supplierDiscountUntil: null, prospecting: {}, trimmerOwned: false,
    playerWorkDays: {}, playerProcessingXp: 0 };
  state.employees.push({ ...structuredClone(KQ_STAFF_CANDIDATES[1]), id: "worker", contract: "cdi", weeklyHours: 35,
    hiredAt: hour(0), endsAt: null, reason: "permanent", status: "active", nextPayrollAt: hour(720), paidUntil: hour(0),
    grossEarnedCents: 0, overtimeGrossCents: 0, finalPaid: false, workDays: {}, leave: [], completedTasks: 0 });
  const starter = createKqWarehouseStarter();
  const warehouse = area === 1 ? starter : getKqWarehouseQuote({ ...starter,
    zones: starter.zones.map(zone => ({ ...zone, width: area })),
    serviceZones: starter.serviceZones!.map(zone => ({ ...zone, width: 2, x: zone.kind === "storage" ? 3 : 0 })),
  }, starter).nextState;
  const raw = { state, revision: 0, serverNow: hour(0), cashCents: 1_000_000, context: {
    businessStartedAt: hour(0), reputation: 0, instagramFollowers: 0, shopPartners: 0, activeRuns: [], processingBatches: [], supplierInvoices: [],
    productionVersion: 1 as const, productionFacility: { warehouseState: warehouse, warehouseRevision: 1, busyZoneIds: [],
      usedStorageGrams: 0, reservedDryingGrams: 0, equipment: [{ code: "SIFT-TRAY", level: 1 }] },
  } };
  configureKqStaffProduction(state, raw, { action: "set-production-rules", enabled: true, zoneId: "starter", route: "flower", maxDailyCostCents: 100_000, cashReserveCents: 0, expectedRevision: 1 });
  return raw;
}
function shift(raw: ReturnType<typeof fixture>, start: number, hours = 7, step: KqProductionStep = "auto", employeeId = "worker", skills = { culture: 4, processing: 3, sales: 2 }) {
  const task: KqStaffTask = { id: `shift-${employeeId}-${start}`, employeeId, kind: "production", skill: "culture", hours,
    startedAt: hour(start), completesAt: hour(start + hours), day: Math.floor(start / 24) + 1, status: "running",
    trainingCostCents: 0, skillLevel: skills.culture, productionStep: step, productionSkills: skills,
    productionTrait: "versatile", productionWorkedHours: 0 };
  raw.state.tasks.push(task); return task;
}
function weeks(raw: ReturnType<typeof fixture>, count: number, step: KqProductionStep = "auto") {
  for (let week = 0; week < count; week++) for (let day = 0; day < 5; day++) shift(raw, (week * 7 + day) * 24, 7, step);
}
function advance(raw: ReturnType<typeof fixture>, hours: number) {
  raw.serverNow = hour(hours);
  const effects: KqStaffEffect[] = [];
  advanceKqStaffProduction(raw.state, raw, effects);
  raw.cashCents += getKqProductionCashDelta(effects);
  return effects;
}
function stock(raw: ReturnType<typeof fixture>, grams = 100, stage: KqProductionLot["stage"] = "ready"): KqProductionLot {
  const lot: KqProductionLot = { id: `stock-${raw.state.production!.lots.length}`, route: "flower", stage, cultureStage: 3,
    createdAt: hour(0), readyAt: hour(0), potentialGrams: grams, grams, equivalentGrams: grams,
    quality: 70, remainingWork: grams, cultureHours: 3, cultureLevelHours: 12, trimQualityGrams: 0,
    processingEfficiencyGrams: 0, processingQualityGrams: 0, processingPaid: false, saleExactCents: 0, saleRoundedCents: 0 };
  raw.state.production!.lots.push(lot); return lot;
}

describe("commercial production facility and isolation", () => {
  it("quotes paid areas, operating costs and explicit shared-capacity quotas", () => {
    const raw = fixture(5), quote = getKqProductionFacilities(raw.context)[0];
    expect(quote).toMatchObject({ areaM2: 5, harvestGrams: 1250, cycleCostCents: 31010,
      dryingCapacityGrams: 1250, storageCapacityGrams: 2400, processingRateGramsPerHour: 750, available: true });
    raw.context.productionFacility!.busyZoneIds = [null];
    expect(getKqProductionFacilities(raw.context)[0].available).toBe(false);
    raw.context.productionFacility!.busyZoneIds = [];
    raw.context.productionFacility!.usedStorageGrams = 1200;
    expect(getKqProductionFacilities(raw.context)[0].available).toBe(false);
  });
  it("rejects stale facility approvals and a budget below the real cycle cost", () => {
    const raw = fixture();
    const command = { action: "set-production-rules" as const, enabled: true, zoneId: "starter", route: "flower" as const, maxDailyCostCents: 100_000, cashReserveCents: 0, expectedRevision: 2 };
    expect(() => configureKqStaffProduction(raw.state, raw, command)).toThrow("changé");
    expect(() => configureKqStaffProduction(raw.state, raw, { ...command, expectedRevision: 1, maxDailyCostCents: 1 })).toThrow("plafond");
  });
  it("accepts its own state and rejects damaged jobs, state or money", () => {
    const raw = fixture(); shift(raw, 0); advance(raw, .001);
    expect(isKqStaffProductionState(raw.state.production)).toBe(true);
    expect(isKqStaffProductionState({ ...raw.state.production, nextId: -1 })).toBe(false);
    const malformed = structuredClone(raw.state.production!); malformed.jobs[0].completesAt = malformed.jobs[0].startedAt;
    expect(isKqStaffProductionState(malformed)).toBe(false);
  });
  it("never touches employee experience, completed tasks, player skills or competitive data", () => {
    const raw = fixture(); weeks(raw, 3);
    const employees = structuredClone(raw.state.employees), context = structuredClone(raw.context);
    advance(raw, 500);
    expect(raw.state.employees).toEqual(employees);
    expect(raw.context).toEqual(context);
    expect(raw.state.playerProcessingXp).toBe(0);
    expect(raw.state.playerSkills).toBeUndefined();
    expect(raw.state.production!.stats.salesCents).toBeGreaterThan(0);
  });
});

describe("production follows labor, material and elapsed time", () => {
  it.each([
    ["2026-11-02T08:00:00.123456Z", "2026-11-02T08:00:00.124Z"],
    ["2026-11-02T09:00:00.123001+01:00", "2026-11-02T08:00:00.124Z"],
    ["2026-11-02T08:00:00.123000Z", "2026-11-02T08:00:00.123Z"],
  ])("never starts before a database authorization at %s", (timestamp, expectedStart) => {
    const raw = fixture();
    raw.serverNow = raw.state.lastSettledAt = raw.state.production!.advancedAt = timestamp;
    raw.state.production!.settings.updatedAt = raw.state.employees[0].hiredAt = timestamp;
    const result = applyKqStaffCommand(raw, { action: "assign-production", employeeId: "worker", hours: 2, productionStep: "auto" }, "precise-shift");
    const task = result.state.tasks.find(task => task.id === "precise-shift")!;
    expect(task.startedAt).toBe(expectedStart);
    expect(Date.parse(task.completesAt) - Date.parse(task.startedAt)).toBe(2 * KQ_PRODUCTION_HOUR_MS);
    expect(result.state.employees[0].workDays["1"].usedHours).toBe(2);
  });
  it("defers a sub-millisecond weekly boundary without skipping or duplicating its shift", () => {
    const raw = fixture(); raw.context.weeklyPlanVersion = 1;
    raw.context.businessStartedAt = "2026-11-02T08:00:00.000456Z";
    raw.state = applyKqStaffCommand(raw, { action: "set-weekly-plan", employeeId: "worker", enabled: true,
      days: [[], [{ kind: "production", productionStep: "culture", hours: 7 }], [], [], []], expectedWeeklyCostCents: 0 }, "precise-plan").state;
    raw.serverNow = "2026-11-02T12:00:00.000456Z";
    raw.state = advanceKqStaff(raw).state;
    expect(raw.state.tasks).toHaveLength(0);
    expect(raw.state.employees[0].weeklyPlan!.nextDay).toBe(2);
    raw.serverNow = "2026-11-02T12:00:00.001Z";
    raw.state = advanceKqStaff(raw).state;
    expect(raw.state.tasks).toHaveLength(1);
    expect(raw.state.tasks[0]).toMatchObject({ day: 2, startedAt: raw.serverNow, hours: 7 });
    expect(raw.state.employees[0].workDays["2"].usedHours).toBe(7);
    expect(advanceKqStaff(raw).state.tasks).toEqual(raw.state.tasks);
  });
  it("uses a 10-minute hour, no instant harvest, three active milestones, then six real hours", () => {
    const raw = fixture(); weeks(raw, 1, "culture");
    expect(KQ_PRODUCTION_HOUR_MS).toBe(600_000);
    const first = advance(raw, 0);
    expect(first).toEqual([]); expect(raw.state.production!.jobs).toHaveLength(0);
    const started = advance(raw, .001);
    expect(started).toHaveLength(1); expect(started[0]).toMatchObject({ kind: "production", event: { type: "cost", at: hour(0) } });
    expect(raw.state.production!.lots[0]).toMatchObject({ stage: "culture", grams: 0, cultureStage: 0 });
    advance(raw, .99); expect(raw.state.production!.lots[0].cultureStage).toBe(0);
    advance(raw, 1); expect(raw.state.production!.lots[0]).toMatchObject({ cultureStage: 1, readyAt: hour(48) });
    advance(raw, 48); expect(raw.state.production!.lots[0].cultureStage).toBe(1);
    advance(raw, 97);
    expect(raw.state.production!.lots[0]).toMatchObject({ cultureStage: 3, stage: "drying", grams: 175, readyAt: hour(133) });
    advance(raw, 132.99); expect(raw.state.production!.lots[0].stage).toBe("drying");
    advance(raw, 133); expect(raw.state.production!.lots[0].stage).toBe("trim");
    expect(raw.state.production!.stats.workedHours).toBe(3);
  });
  it("suspends unfinished labor at the shift end and resumes without early material", () => {
    const raw = fixture(5); const first = shift(raw, 0, 2, "culture"); const second = shift(raw, 24, 3, "culture");
    advance(raw, 20);
    expect(first.productionWorkedHours).toBe(2);
    expect(raw.state.production!.lots[0]).toMatchObject({ remainingWork: 3, cultureStage: 0, grams: 0 });
    advance(raw, 26.99); expect(raw.state.production!.lots[0].cultureStage).toBe(0);
    advance(raw, 27); expect(second.productionWorkedHours).toBe(3);
    expect(raw.state.production!.lots[0]).toMatchObject({ cultureStage: 1, readyAt: hour(48), remainingWork: 5 });
  });
  it("does not work outside the contract calendar, during leave, or after contract end", () => {
    const raw = fixture(); raw.state.employees[0].leave = [{ id: "leave", startDay: 1, endDay: 1, days: 1 }];
    raw.state.employees[0].endsAt = hour(24);
    shift(raw, 0); shift(raw, 24); shift(raw, 120);
    advance(raw, 140);
    expect(raw.state.production!.stats.cycles).toBe(0);
    expect(raw.state.production!.stats.workedHours).toBe(0);
  });
  it("interrupts a segment exactly at a contract ending in the middle of a shift", () => {
    const raw = fixture(5); raw.state.employees[0].endsAt = hour(2);
    const task = shift(raw, 0, 7, "culture"); advance(raw, 7);
    expect(task.productionWorkedHours).toBe(2);
    expect(raw.state.production!.lots[0]).toMatchObject({ cultureStage: 0, remainingWork: 3 });
  });
  it("keeps active machine work exclusive and charges transformation once across shifts", () => {
    const raw = fixture(); raw.state.production!.settings.enabled = false;
    const a = stock(raw, 400, "processing"), b = stock(raw, 400, "processing"); a.route = b.route = "dry-sift";
    raw.state.employees.push({ ...structuredClone(raw.state.employees[0]), id: "second" });
    shift(raw, 0, .5, "processing"); shift(raw, 0, .5, "processing", "second"); shift(raw, 24, 3, "processing");
    const first = advance(raw, .001);
    expect(raw.state.production!.jobs).toHaveLength(1);
    expect(first.filter(row => row.kind === "production" && row.event.type === "cost")).toHaveLength(1);
    advance(raw, .5); expect(a.stage).toBe("processing"); expect(a.remainingWork).toBeCloseTo(156.25);
    const after = advance(raw, 27);
    expect(after.filter(row => row.kind === "production" && row.event.type === "cost")).toHaveLength(1);
    expect(raw.state.production!.stats.processedInputGrams).toBe(800);
    expect(raw.state.production!.stats.producedGrams).toBeCloseTo(93.6);
    expect(raw.state.production!.stats.costCents).toBe(14400);
  });
  it("uses the processing skill for trim and sales skill for delivery, without a second versatile bonus", () => {
    const raw = fixture(); raw.state.production!.settings.enabled = false;
    const lot = stock(raw, 80, "trim");
    const task = shift(raw, 0, 2, "auto", "worker", { culture: 10, processing: 3, sales: 1 });
    advance(raw, .99); expect(lot.stage).toBe("trim");
    advance(raw, 1); expect(lot.stage).toBe("ready"); expect(lot.quality).toBe(71);
    advance(raw, 1.001);
    expect(raw.state.production!.jobs[0]).toMatchObject({ step: "sell", work: 80, hours: .32, skillLevel: 1 });
    advance(raw, 1.32); expect(task.productionWorkedHours).toBe(1.32);
  });
  it("applies transformation quality once, weighted by the grams handled by each worker", () => {
    const raw = fixture(); raw.state.production!.settings.enabled = false;
    const lot = stock(raw, 400, "processing"); lot.route = "dry-sift";
    shift(raw, 0, .5, "processing", "worker", { culture: 1, processing: 1, sales: 1 });
    shift(raw, 24, 1, "processing", "worker", { culture: 1, processing: 10, sales: 1 });
    advance(raw, .5); expect(lot.quality).toBe(70);
    advance(raw, 25);
    expect(lot.stage).toBe("ready");
    expect(lot.quality).toBe(70.96875); // novice 206.25 g × 0; expert 193.75 g × 2
    const quality = lot.quality; advance(raw, 26); expect(lot.quality).toBe(quality);
    expect(lot.grams).toBe(55.29375);
  });
  it.each([[1, 70], [5, 71], [10, 72]])("uses processing level %i for a whole lot's final quality", (level, expected) => {
    const raw = fixture(); raw.state.production!.settings.enabled = false;
    const lot = stock(raw, 400, "processing"); lot.route = "dry-sift";
    shift(raw, 0, 2, "processing", "worker", { culture: 1, processing: level, sales: 1 });
    advance(raw, 2); expect(lot.quality).toBe(expected);
  });
});

describe("production replay and money", () => {
  it("gives the exact same state, receipts and cash on frequent visits and a long absence", () => {
    const offline = fixture(5); weeks(offline, 5);
    const online = structuredClone(offline), receipts: KqStaffEffect[] = [];
    const expected = advance(offline, 800);
    for (let t = 0; t <= 800; t += .5) receipts.push(...advance(online, t));
    expect(online.state.production).toEqual(offline.state.production);
    expect(online.state.tasks).toEqual(offline.state.tasks);
    expect(online.cashCents).toBe(offline.cashCents);
    expect(receipts).toEqual(expected);
    expect(advance(online, 800)).toEqual([]);
  });
  it("shares demand between workers and stops at 500 equivalent grams per game day", () => {
    const raw = fixture(); raw.state.production!.settings.enabled = false;
    stock(raw, 400); stock(raw, 400);
    raw.state.employees.push({ ...structuredClone(raw.state.employees[0]), id: "second" });
    shift(raw, 0, 7, "sell"); shift(raw, 0, 7, "sell", "second");
    advance(raw, 7);
    expect(raw.state.production!.stats.soldEquivalentGrams).toBe(500);
    expect(raw.state.production!.lots.reduce((sum, lot) => sum + lot.grams, 0)).toBe(300);
    expect(raw.state.production!.stats.vatCents).toBe(Math.round(raw.state.production!.stats.salesCents / 6));
    shift(raw, 24, 7, "sell"); advance(raw, 31);
    expect(raw.state.production!.lots).toHaveLength(0);
    expect(raw.state.production!.facility).toBeNull();
  });
  it("is independent of employee/task array ordering, including simultaneous demand contention", () => {
    const first = fixture(); first.state.production!.settings.enabled = false;
    stock(first, 400); stock(first, 400);
    first.state.employees.push({ ...structuredClone(first.state.employees[0]), id: "second" });
    shift(first, 0, 7, "sell"); shift(first, 0, 7, "sell", "second");
    const other = structuredClone(first); other.state.tasks.reverse(); other.state.employees.reverse();
    expect(advance(other, 7)).toEqual(advance(first, 7));
    expect(other.state.production).toEqual(first.state.production);
  });
  it("registers all same-instant weekly shifts before allocating production, independently of employee order", () => {
    const first = fixture(); first.context.weeklyPlanVersion = 1;
    first.state.employees.push({ ...structuredClone(first.state.employees[0]), id: "aaa-expert", skills: { culture: 8100, processing: 8100, sales: 8100, communication: 0, administration: 0 } });
    const other = structuredClone(first); other.state.employees.reverse();
    for (const raw of [first, other]) {
      for (const employee of [...raw.state.employees]) {
        const next = applyKqStaffCommand(raw, { action: "set-weekly-plan", employeeId: employee.id, enabled: true,
          days: [[], [{ kind: "production", productionStep: "culture", hours: 7 }], [], [], []], expectedWeeklyCostCents: 0 }, `plan-${employee.id}`);
        raw.state = next.state;
      }
      raw.serverNow = hour(26);
    }
    const a = advanceKqStaff(first), b = advanceKqStaff(other);
    expect(a.state.production).toEqual(b.state.production);
    expect(a.effects).toEqual(b.effects);
    expect(a.state.production!.lots[0].cultureLevelHours).toBe(10);
  });
  it("retains unpaid work and never borrows from future sale proceeds", () => {
    const raw = fixture(); raw.cashCents = 0; const task = shift(raw, 0, 7, "culture");
    advance(raw, 7);
    expect(task.productionWorkedHours).toBe(0); expect(raw.state.production!.lots).toHaveLength(0);
    raw.cashCents = 100_000; advance(raw, 8);
    expect(raw.state.production!.stats.cycles).toBe(0); // expired hours never resurrect
  });
  it("preserves the treasury reserve and daily expense limit", () => {
    const raw = fixture(); shift(raw, 0, 7, "culture");
    raw.state.production!.settings.cashReserveCents = raw.cashCents;
    advance(raw, 0); expect(raw.state.production!.stats.costCents).toBe(0);
    raw.state.production!.settings.cashReserveCents = 0;
    raw.state.production!.budget = { day: 1, spentCents: raw.state.production!.settings.maxDailyCostCents };
    advance(raw, 1); expect(raw.state.production!.stats.cycles).toBe(0);
  });
  it("disabling stops new cycles, finishes existing material and releases the reservation when empty", () => {
    const raw = fixture(); const lot = stock(raw, 40, "trim"); shift(raw, 0);
    configureKqStaffProduction(raw.state, raw, { ...raw.state.production!.settings, action: "set-production-rules", enabled: false, zoneId: null });
    expect(raw.state.production!.settings.zoneId).toBe("starter");
    advance(raw, 7);
    expect(lot.stage).toBe("ready"); expect(raw.state.production!.stats.soldGrams).toBe(40);
    expect(raw.state.production!.stats.cycles).toBe(0); expect(raw.state.production!.facility).toBeNull();
  });
  it("weights quality by actual culture work rather than the final worker", () => {
    const raw = fixture(); shift(raw, 0, 1, "culture", "worker", { culture: 1, processing: 1, sales: 1 });
    shift(raw, 48, 1, "culture", "worker", { culture: 1, processing: 1, sales: 1 });
    shift(raw, 96, 1, "culture", "worker", { culture: 10, processing: 1, sales: 1 });
    advance(raw, 97);
    expect(raw.state.production!.lots[0]).toMatchObject({ grams: 175, quality: 66 });
  });
  it("handles fractional grams and retires sold lots instead of growing historical state", () => {
    const raw = fixture(); raw.state.production!.settings.enabled = false;
    stock(raw, .013); shift(raw, 0, .5, "sell");
    const receipts = advance(raw, .5);
    expect(receipts).toHaveLength(1);
    expect(raw.state.production!.lots).toHaveLength(0);
    expect(raw.state.production!.stats.soldGrams).toBe(.013);
    expect(raw.state.production!.stats.workedHours).toBeGreaterThan(0);
    expect(raw.state.production!.stats.workedHours).toBeLessThan(.5);
  });
  it("never exceeds its explicit storage quota while several weeks elapse", () => {
    const raw = fixture(); weeks(raw, 6, "culture"); advance(raw, 1000);
    const state = raw.state.production!;
    expect(state.lots.reduce((sum, lot) => sum + (lot.stage === "culture" ? lot.potentialGrams : lot.grams), 0)).toBeLessThanOrEqual(state.facility!.storageCapacityGrams);
    expect(state.lots.length).toBeLessThanOrEqual(3);
    expect(isKqStaffProductionState(state)).toBe(true);
  });
  it("covers operating costs and the catalogue worker's salary over 30 days after the first cycle", () => {
    const raw = fixture(5); weeks(raw, 6); advance(raw, 168);
    const opening = structuredClone(raw.state.production!.stats); advance(raw, 888);
    const stats = raw.state.production!.stats;
    // Fictional balance check; equipment is already funded, account-wide debt and depreciation are excluded.
    const grossSalary = Math.round(1340 * 35 * 52 / 12);
    const monthlyEmployerCost = grossSalary + Math.round(grossSalary * .35);
    const cashMargin = stats.salesCents - opening.salesCents - (stats.vatCents - opening.vatCents) - (stats.costCents - opening.costCents) - monthlyEmployerCost;
    expect(cashMargin, JSON.stringify({ stats, opening })).toBeGreaterThan(0);
    expect(raw.state.tasks.every(task => (task.productionWorkedHours ?? 0) <= task.hours)).toBe(true);
  });
});
