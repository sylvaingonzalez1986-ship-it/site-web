import { describe, expect, it } from "vitest";
import { KQ_GAME_DAY_MS } from "./kanab-quest-business";
import { advanceKqStaff, applyKqStaffCommand, createKqStaffState, parseKqStaffCommand, projectKqStaffSnapshot } from "./kanab-quest-staff";
import { getKqPlayerSkills, getKqPlayerWorkday } from "./kanab-quest-player-work";
import type { KqStaffCommand, KqStaffRawSnapshot, KqStaffState } from "./kanab-quest-staff-types";

const start = "2026-11-07T00:00:00.000Z";
const day = (n: number, h = 0) => new Date(Date.parse(start) + (n - 1 + h / 24) * KQ_GAME_DAY_MS).toISOString();
function raw(state: KqStaffState | null = null, serverNow = start): KqStaffRawSnapshot {
  return { state, serverNow, revision: 0, cashCents: 100_000, context: { businessStartedAt: start, reputation: 3000, instagramFollowers: 10000, shopPartners: 120,
    activeRuns: [{ id: "culture", name: "Chanvre" }], processingBatches: [{ id: "batch", flowerId: "flower", name: "Hash", startedAt: start, readyAt: day(3) }], supplierInvoices: [],
    trimLots: [{ flowerId: "trim", name: "Fleurs", requiredWork: 6, completedWork: 0, completedAt: null, mode: null }] } };
}
const city = (hours = 2): KqStaffCommand => ({ action: "player-assign", kind: "sales", cityId: "brest", hours, expectedCostCents: 6000 });
const rural = (department = "29"): KqStaffCommand => ({ action: "player-assign", kind: "countryside", department, hours: 12, expectedCostCents: 4000 });

describe("personal work shared across the farm", () => {
  it("allows city prospecting without a single employee, including weekends", () => {
    const result = applyKqStaffCommand(raw(null, day(6)), city(), "city");
    expect(result.state.employees).toEqual([]);
    expect(result.debitCents).toBe(6000);
    expect(result.state.tasks[0]).toMatchObject({ employeeId: "player", kind: "sales", cityId: "brest", hours: 2, skillLevel: 1 });
    expect(getKqPlayerWorkday(projectKqStaffSnapshot(raw(result.state, day(6))))).toMatchObject({ usedHours: 2, dailyHours: 12, remainingHours: 10 });
  });
  it("charges a full 12-hour day for a rural trip with no salary or guaranteed reward", () => {
    const result = applyKqStaffCommand(raw(), rural(), "rural");
    expect(result.debitCents).toBe(4000);
    expect(result.effects).toEqual([]);
    expect(result.state.tasks[0]).toMatchObject({ kind: "countryside", department: "29", completesAt: day(1, 12) });
    expect(result.state.playerWorkDays["1"].usedHours).toBe(12);
    expect(() => applyKqStaffCommand(raw(result.state), city(), "exhausted")).toThrow(/12 h/);
  });
  it.each(["22", "29", "35", "56"])("supports the Breton department %s", department => {
    expect(applyKqStaffCommand(raw(), rural(department), department).state.tasks[0].department).toBe(department);
  });
  it("shares hours with trim in both directions and queues personal work", () => {
    const trim: KqStaffCommand = { action: "trim", employeeId: null, flowerId: "trim", mode: "manual", hours: 3, expectedCostCents: 0 };
    const first = applyKqStaffCommand(raw(), city(), "city");
    const second = applyKqStaffCommand(raw(first.state), trim, "trim");
    expect(second.state.tasks[1].startedAt).toBe(first.state.tasks[0].completesAt);
    expect(second.state.playerWorkDays["1"].usedHours).toBe(5);
    expect(() => applyKqStaffCommand(raw(second.state), city(8), "too-much")).toThrow(/12 h/);
    const trimmed = applyKqStaffCommand(raw(), trim, "trim-first");
    expect(() => applyKqStaffCommand(raw(trimmed.state), rural(), "full-day")).toThrow(/12 h/);
  });
  it("renews exactly at the server game-day boundary without accumulating unused hours", () => {
    const done = applyKqStaffCommand(raw(), rural(), "trip");
    expect(getKqPlayerWorkday(projectKqStaffSnapshot(raw(done.state, day(2))))).toMatchObject({ usedHours: 0, remainingHours: 12, day: 2 });
    expect(applyKqStaffCommand(raw(done.state, day(2)), rural(), "next-trip").state.playerWorkDays["2"].usedHours).toBe(12);
  });
  it("does not reset legacy trim usage or processing experience", () => {
    const state = createKqStaffState(start); state.playerWorkDays["1"] = { usedHours: 7 }; state.playerProcessingXp = 144;
    const next = applyKqStaffCommand(raw(state), city(), "city");
    expect(next.state.playerWorkDays["1"].usedHours).toBe(9);
    expect(getKqPlayerSkills(next.state).processing).toBe(144);
    expect(state.playerWorkDays["1"].usedHours).toBe(7);
  });
  it("refuses changed travel budgets, unknown targets, partial rural days and late departures", () => {
    expect(() => applyKqStaffCommand(raw(), { ...city(), expectedCostCents: 0 } as KqStaffCommand, "a")).toThrow(/budget/);
    expect(() => applyKqStaffCommand(raw(), { ...city(), cityId: "paris" } as KqStaffCommand, "a")).toThrow(/ville/);
    expect(() => applyKqStaffCommand(raw(), rural("44"), "a")).toThrow(/département/);
    expect(() => applyKqStaffCommand(raw(), { ...rural(), hours: 6 } as KqStaffCommand, "a")).toThrow(/journée entière/);
    expect(() => applyKqStaffCommand(raw(null, day(1, 13)), rural(), "a")).toThrow(/trop peu de temps/);
    expect(() => applyKqStaffCommand({ ...raw(), cashCents: 0 }, city(), "a")).toThrow(/Trésorerie/);
  });
  it("settles personal prospecting once, gives sales experience, and keeps existing partners", () => {
    const planned = applyKqStaffCommand(raw(), city(), "successful-city");
    planned.state.tasks[0].successChance = 100;
    const done = advanceKqStaff(raw(planned.state, planned.state.tasks[0].completesAt));
    expect(done.effects).toEqual([{ kind: "sales", shopPartners: 1, reputation: 5 }]);
    expect(done.state.playerSkills?.sales).toBe(24);
    expect(done.state.prospecting.brest).toBe(1);
    expect(advanceKqStaff(raw(done.state, day(2))).effects).toEqual([]);
  });
  it("settles rural trips to at most two partners with separate rural history", () => {
    const planned = applyKqStaffCommand(raw(), rural(), "rural");
    planned.state.tasks[0].successChance = 100;
    const done = advanceKqStaff(raw(planned.state, day(1, 12)));
    expect(done.effects).toEqual([{ kind: "sales", shopPartners: 2, reputation: 10 }]);
    expect(done.state.prospecting).toEqual({ "countryside-29": 2 });
    expect(done.state.playerSkills?.sales).toBe(144);
    const failed = structuredClone(planned.state); failed.tasks[0].successChance = 0;
    expect(advanceKqStaff(raw(failed, day(1, 12))).effects).toEqual([]);
  });
  it.each(["culture", "processing", "communication", "administration"] as const)("allows personal %s work and grants its own XP", kind => {
    const planned = applyKqStaffCommand(raw(), { action: "player-assign", kind, hours: 2, targetId: kind === "culture" ? "culture" : "flower", expectedCostCents: 0 }, kind);
    const done = advanceKqStaff(raw(planned.state, day(1, 2)));
    expect(done.state.tasks[0].status).toBe("completed");
    expect(done.state.playerSkills?.[kind]).toBe(24);
    if (kind === "administration") expect(done.state.supplierDiscountPercent).toBeGreaterThan(0);
    else expect(done.effects[0].kind).toBe(kind);
    if (kind === "processing") expect(done.state.playerProcessingXp).toBe(24);
  });
  it("whitelists the command without trusting client state, skills or outcome", () => {
    expect(parseKqStaffCommand({ ...rural(), playerSkills: { sales: 8100 }, state: {}, successChance: 100, employeeId: "fake" })).toEqual(rural());
    expect(() => parseKqStaffCommand({ ...city(), kind: "training" })).toThrow(/Compétence/);
  });
});
