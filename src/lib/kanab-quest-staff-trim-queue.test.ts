import { describe, expect, it } from "vitest";
import { KQ_GAME_DAY_MS } from "./kanab-quest-business";
import { advanceKqStaff, applyKqStaffCommand, createKqStaffState, KQ_STAFF_CANDIDATES, parseKqStaffCommand } from "./kanab-quest-staff";
import { getKqStaffSharedTrimQuote, getKqStaffTrimRate } from "./kanab-quest-staff-trim";
import type { KqStaffCommand, KqStaffEffect, KqStaffRawSnapshot, KqStaffTrimLot } from "./kanab-quest-staff-types";

const START = Date.parse("2026-11-02T08:00:00Z");
const hour = (value: number) => new Date(START + value * KQ_GAME_DAY_MS / 24).toISOString();
function lot(id = "a", grams = 1000, created = 0): KqStaffTrimLot {
  return { flowerId: id, name: `Chanvre ${id}`, requiredWork: 6, completedWork: 0, totalGrams: grams, completedGrams: 0, createdAt: hour(created), mode: null, completedAt: null };
}
function raw(lots = [lot()]): KqStaffRawSnapshot {
  const state = createKqStaffState(hour(0));
  state.employees.push({ ...structuredClone(KQ_STAFF_CANDIDATES[0]), id: "worker", trait: "learner", skills: { culture: 0, processing: 0, communication: 0, sales: 0, administration: 0 },
    contract: "cdi", weeklyHours: 35, hiredAt: hour(0), endsAt: null, reason: "permanent", status: "active", nextPayrollAt: hour(720), paidUntil: hour(0), grossEarnedCents: 0, overtimeGrossCents: 0, finalPaid: false, workDays: {}, leave: [], completedTasks: 0 });
  return { state, revision: 0, archiveCount: 0, serverNow: hour(0), cashCents: 1_000_000, context: {
    businessStartedAt: hour(0), reputation: 0, instagramFollowers: 0, shopPartners: 0, activeRuns: [], processingBatches: [], supplierInvoices: [], trimQueueVersion: 2, trimLots: lots,
  } };
}
function effectsInto(snapshot: KqStaffRawSnapshot, effects: KqStaffEffect[]) {
  for (const effect of effects) if (effect.kind === "trim-work") {
    const row = snapshot.context.trimLots!.find(item => item.flowerId === effect.flowerId)!;
    row.completedGrams = Math.min(row.totalGrams!, Number((row.completedGrams! + (effect.unit === "g" ? effect.work : effect.work / 6 * row.totalGrams!)).toFixed(6)));
    row.mode = effect.mode;
    row.completedWork = row.completedGrams === row.totalGrams ? 6 : Math.min(5.99, row.completedGrams! / row.totalGrams! * 6);
    if (row.completedGrams === row.totalGrams) row.completedAt = snapshot.serverNow;
  }
}
function command(employeeId: string | null = null, hours = 2, mode: "manual" | "machine" = "manual"): Extract<KqStaffCommand, { action: "trim" }> {
  return { action: "trim", employeeId, hours, mode, expectedCostCents: 0 };
}
function assign(snapshot: KqStaffRawSnapshot, employeeId: string | null = null, hours = 2, id = employeeId ?? "player", mode: "manual" | "machine" = "manual") {
  const result = applyKqStaffCommand(snapshot, command(employeeId, hours, mode), id);
  snapshot.state = result.state; effectsInto(snapshot, result.effects);
  return result;
}
function advance(snapshot: KqStaffRawSnapshot, time: number) {
  snapshot.serverNow = hour(time);
  const result = advanceKqStaff(snapshot);
  snapshot.state = result.state; effectsInto(snapshot, result.effects);
  return result;
}

describe("shared trim shifts in actual harvested grams", () => {
  it("uses precisely 60–150 manual g/game-hour, with a fourfold machine and no second speed bonus", () => {
    expect(Array.from({ length: 10 }, (_, i) => getKqStaffTrimRate(i + 1, "manual"))).toEqual([60, 70, 80, 90, 100, 110, 120, 130, 140, 150]);
    expect(getKqStaffTrimRate(10, "machine")).toBe(600);
    for (const trait of ["quick", "meticulous", "learner"] as const) {
      expect(getKqStaffSharedTrimQuote({ mode: "manual", hours: 1, level: 1, trait })).toMatchObject({ grams: 60, gramsPerHour: 60, durationMs: KQ_GAME_DAY_MS / 24 });
    }
  });

  it("admits the player and an employee on the same small harvest without exclusive gram reservations", () => {
    const snapshot = raw([lot("a", 60)]);
    assign(snapshot); assign(snapshot, "worker");
    expect(snapshot.state!.tasks.map(task => task.startedAt)).toEqual([hour(0), hour(0)]);
    expect(snapshot.state!.tasks.every(task => !task.targetId && task.trimQueue)).toBe(true);
    const progress = advance(snapshot, 0.25);
    expect(progress.effects).toEqual([{ kind: "trim-work", unit: "g", flowerId: "a", mode: "manual", work: 30, qualityDelta: 1 }]);
    expect(snapshot.state!.tasks.map(task => task.trimGrams)).toEqual([15, 15]);
    advance(snapshot, 2);
    expect(snapshot.state!.tasks.map(task => task.trimGrams)).toEqual([30, 30]);
    expect(snapshot.state!.playerProcessingXp).toBe(6);
    expect(snapshot.state!.employees[0].skills.processing).toBe(8); // 0.5 productive hour × 12 × learner1.25
    expect(snapshot.state!.playerWorkDays["1"].usedHours).toBe(2);
    expect(snapshot.state!.employees[0].workDays["1"].usedHours).toBe(2);
    expect(advance(snapshot, 2).effects).toEqual([]);
  });

  it("lets a colleague join midway, including when the first shift could finish all remaining stock", () => {
    const snapshot = raw([lot("a", 90)]);
    assign(snapshot);
    snapshot.serverNow = hour(0.5);
    assign(snapshot, "worker", 1);
    expect(snapshot.context.trimLots![0].completedGrams).toBe(30);
    advance(snapshot, 2);
    expect(snapshot.state!.tasks.map(task => task.trimGrams)).toEqual([60, 30]);
    expect(snapshot.context.trimLots![0].completedGrams).toBe(90);
  });

  it("moves across harvests automatically in harvest order, independently of a stale legacy flowerId", () => {
    const snapshot = raw([lot("z", 40), lot("a", 200, 0.1)]);
    snapshot.serverNow = hour(0.2);
    snapshot.state = applyKqStaffCommand(snapshot, { ...command(), flowerId: "a" }, "player").state;
    assign(snapshot, "worker");
    advance(snapshot, 1.2);
    expect(snapshot.context.trimLots!.map(row => row.completedGrams)).toEqual([40, 80]);
    expect(snapshot.state!.tasks[0].trimContributions).toEqual([{ flowerId: "z", grams: 20 }, { flowerId: "a", grams: 40 }]);
  });

  it("does not trim a later harvest before its creation or consume expired shifts on return", () => {
    const snapshot = raw([lot("a", 30)]);
    assign(snapshot, null, 2);
    snapshot.context.trimLots!.push(lot("b", 1000, 1.5), lot("c", 1000, 3));
    advance(snapshot, 10);
    expect(snapshot.context.trimLots!.map(row => row.completedGrams)).toEqual([30, 30, 0]);
    expect(snapshot.state!.tasks[0].trimGrams).toBe(60);
    expect(snapshot.state!.playerProcessingXp).toBe(12);
  });

  it("preserves each worker's own queue and counts only productive elapsed time", () => {
    const snapshot = raw();
    assign(snapshot, null, 1, "first"); assign(snapshot, null, 1, "second"); assign(snapshot, "worker", 2);
    expect(snapshot.state!.tasks[1].startedAt).toBe(hour(1));
    advance(snapshot, 0.5);
    expect(snapshot.state!.tasks.map(task => task.trimGrams)).toEqual([30, 0, 30]);
    advance(snapshot, 2);
    expect(snapshot.state!.tasks.map(task => task.trimGrams)).toEqual([60, 60, 120]);
    expect(snapshot.context.trimLots![0].completedGrams).toBe(240);
  });

  it("keeps methods separate, weights effects by each contributor, and never invents extra stock", () => {
    const snapshot = raw([lot("a", 73.1), { ...lot("b", 200), mode: "machine", completedGrams: 10, completedWork: 0.3 }]);
    snapshot.state!.trimmerOwned = true;
    snapshot.state!.employees[0].skills.processing = 8100;
    snapshot.state!.employees[0].trait = "meticulous";
    assign(snapshot, null, 1); assign(snapshot, "worker", 1, "worker", "machine");
    const result = advance(snapshot, 1);
    expect(snapshot.context.trimLots!.map(row => row.completedGrams)).toEqual([60, 200]);
    expect(result.effects).toEqual([
      { kind: "trim-work", unit: "g", flowerId: "a", mode: "manual", work: 60, qualityDelta: 1 },
      { kind: "trim-work", unit: "g", flowerId: "b", mode: "machine", work: 190, qualityDelta: -1 },
    ]);
  });

  it("gives colleagues proportional credit at different Transformation levels", () => {
    const snapshot = raw([lot("a", 210)]);
    snapshot.state!.employees[0].skills.processing = 8100;
    assign(snapshot, null, 2); assign(snapshot, "worker", 2);
    const result = advance(snapshot, 2);
    expect(snapshot.state!.tasks.map(task => task.trimGrams)).toEqual([60, 150]);
    expect(result.effects.map(effect => effect.kind === "trim-work" && [effect.work, effect.qualityDelta])).toEqual([[60, 1], [150, 3]]);
  });

  it("keeps frequent reads equivalent to a single return and never credits a repeated timestamp", () => {
    const once = raw([lot("a", 73.1), lot("b", 500)]), often = structuredClone(once);
    for (const snapshot of [once, often]) { assign(snapshot, null, 2); assign(snapshot, "worker", 2); }
    advance(once, 2);
    for (let i = 1; i <= 120; i++) advance(often, i / 60);
    expect(often.context.trimLots!.map(row => row.completedGrams)).toEqual(once.context.trimLots!.map(row => row.completedGrams));
    expect(often.state!.tasks.map(task => task.trimGrams)).toEqual(once.state!.tasks.map(task => task.trimGrams));
    expect(advance(often, 2).effects).toEqual([]);
  });

  it("honors legacy reservations until their original finish, then joins their remaining harvest", () => {
    const snapshot = raw([lot("a", 600), lot("b", 60)]);
    snapshot.state!.tasks.push({ id: "legacy", employeeId: "worker", kind: "trim", skill: "processing", hours: 1, day: 1, startedAt: hour(0), completesAt: hour(1), status: "running", targetId: "a", trimMode: "manual", trimWork: 1, trimQualityDelta: 1, skillLevel: 1, trainingCostCents: 0 });
    assign(snapshot);
    const result = advance(snapshot, 2);
    expect(result.effects[0]).toMatchObject({ work: 1, flowerId: "a" });
    expect(snapshot.context.trimLots!.map(row => row.completedGrams)).toEqual([160, 60]);
    expect(snapshot.state!.tasks.find(task => task.trimQueue)!.trimGrams).toBe(120);
  });

  it("finishes the final microgram even when nine expert workers exhaust it within epoch-clock precision", () => {
    const snapshot = raw([{ ...lot("a", 1), mode: "machine", completedGrams: 0.999999, completedWork: 5.99 }]);
    snapshot.state!.trimmerOwned = true; snapshot.state!.playerProcessingXp = 8100;
    snapshot.state!.employees[0].skills.processing = 8100;
    for (let i = 1; i < 8; i++) snapshot.state!.employees.push({ ...structuredClone(snapshot.state!.employees[0]), id: `worker-${i}` });
    assign(snapshot, null, 0.5, "player", "machine");
    for (const employee of snapshot.state!.employees) assign(snapshot, employee.id, 0.5, employee.id, "machine");
    const result = advance(snapshot, 0.5);
    expect(snapshot.context.trimLots![0].completedGrams).toBe(1);
    expect(snapshot.context.trimLots![0].completedAt).not.toBeNull();
    expect(result.effects.reduce((sum, effect) => sum + (effect.kind === "trim-work" ? effect.work : 0), 0)).toBe(0.000001);
  });

  it("preserves weekend, leave, payroll, machine, end-of-day and personal budget checks", () => {
    const snapshot = raw();
    expect(() => assign(snapshot, null, 1, "machine", "machine")).toThrow(/machine/);
    snapshot.state!.employees[0].leave = [{ id: "leave", startDay: 1, endDay: 1, days: 1 }];
    expect(() => assign(snapshot, "worker")).toThrow(/congés/);
    snapshot.serverNow = hour(120);
    expect(() => assign(snapshot, "worker")).toThrow(/Repos/);
    assign(snapshot, null, 12);
    expect(() => assign(snapshot, null, 0.5, "overflow")).toThrow(/12 h/);
    const late = raw(); late.serverNow = hour(23.75);
    expect(() => assign(late, null, 0.5)).toThrow(/temps/);
    const debt = raw(); debt.state!.payroll.push({ id: "debt", employeeId: "worker", dueAt: hour(0), grossCents: 100, employerCents: 0, indemnityCents: 0, totalCents: 100, paidCents: 0 });
    expect(() => assign(debt, "worker")).toThrow(/salaires/);
  });

  it("accepts a command with no harvest choice, strips invented rates, and preserves old receipt identity", () => {
    expect(parseKqStaffCommand({ ...command(), trimRateGramsPerHour: 99999, targetId: "cheat", unit: "g" })).toEqual(command());
    const legacy = { ...command(), flowerId: "legacy-id" };
    expect(parseKqStaffCommand(legacy)).toEqual(legacy);
    const unavailable = raw(); delete unavailable.context.trimQueueVersion;
    expect(() => assign(unavailable)).toThrow(/mise à jour/);
    expect(() => assign(raw([]))).toThrow(/Aucune récolte/);
  });
});
