import { describe, expect, it } from "vitest";
import { KQ_GAME_DAY_MS } from "./kanab-quest-business";
import { getKqStaffBenefitPreview } from "./kanab-quest-staff-benefits";
import { advanceKqStaff, applyKqStaffCommand, canKqStaffAssignWithOutstandingPayroll, getKqStaffMonthlyCost, isKqStaffState, KQ_STAFF_CANDIDATES, KQ_STAFF_CITIES, parseKqStaffCommand } from "./kanab-quest-staff";
import type { KqStaffCommand, KqStaffPlannedTask, KqStaffRawSnapshot, KqStaffSkill, KqStaffSkills } from "./kanab-quest-staff-types";

const START = Date.parse("2026-11-08T12:00:00Z");
const at = (day: number, hour = 0) => new Date(START + (day - 1 + hour / 24) * KQ_GAME_DAY_MS).toISOString();
const skills = (level: number): KqStaffSkills => ({ culture: (level - 1) ** 2 * 100, processing: (level - 1) ** 2 * 100,
  communication: (level - 1) ** 2 * 100, sales: (level - 1) ** 2 * 100, administration: (level - 1) ** 2 * 100 });
function fixture() {
  const raw: KqStaffRawSnapshot = { state: null, revision: 0, serverNow: at(1), cashCents: 10_000_000,
    context: { businessStartedAt: at(1), reputation: 0, instagramFollowers: 0, shopPartners: 0,
      activeRuns: [], processingBatches: [], supplierInvoices: [], staffBenefitsVersion: 1, weeklyPlanVersion: 1,
      cultureWorkVersion: 1, processingWorkVersion: 1, trimQueueVersion: 2 } };
  const candidate = KQ_STAFF_CANDIDATES.find(row => row.code === "anna")!;
  const hired = applyKqStaffCommand(raw, { action: "hire", candidateCode: candidate.code, contract: "cdi", weeklyHours: 35,
    durationMonths: 0, reason: "permanent", expectedMonthlyCostCents: getKqStaffMonthlyCost(candidate, 35).totalCents }, "employee");
  return { ...raw, state: hired.state };
}
const rules: Extract<KqStaffCommand, { action: "set-administration-rules" }> = {
  action: "set-administration-rules", enabled: true, employeeId: "employee", paySuppliers: true, payPayroll: true,
  maxDailyCents: 100_000, cashReserveCents: 20_000, supplierDueDays: 2,
};
function metric(kind: KqStaffSkill | "training" | "trim", level: number, label: string, hours = 2) {
  const preview = getKqStaffBenefitPreview({ actor: { skills: skills(level) }, kind, hours, context: fixture().context });
  return preview.metrics.find(row => row.label === label)!.value;
}

describe("staff benefit forecasts", () => {
  it("forecasts comparable sector benefits at levels 1, 5 and 10", () => {
    expect([1, 5, 10].map(level => metric("processing", level, "Efficacité"))).toEqual([55, 75, 100]);
    expect([1, 5, 10].map(level => metric("trim", level, "Cadence"))).toEqual([60, 100, 150]);
    expect([1, 5, 10].map(level => metric("communication", level, "Abonnés Instagram au maximum"))).toEqual([20, 52, 92]);
    expect([1, 5, 10].map(level => metric("communication", level, "Réputation proposée"))).toEqual([1, 3, 5]);
    expect([1, 5, 10].map(level => metric("administration", level, "Remise fournisseurs négociable"))).toEqual([1, 4, 7]);
  });

  it("does not scale an administrative discount with mission duration", () => {
    const raw = fixture(), actor = { ...raw.state.employees[0], skills: skills(5), trait: "organized" as const };
    const short = getKqStaffBenefitPreview({ actor, kind: "administration", hours: .5, context: raw.context });
    const long = getKqStaffBenefitPreview({ actor, kind: "administration", hours: 7, context: raw.context });
    expect(short.metrics.slice(0, 2)).toEqual(long.metrics.slice(0, 2));
    expect(short.metrics[2].value).toBe(6); expect(long.metrics[2].value).toBe(84);
    expect(short.metrics[0]).toMatchObject({ value: 6, unit: "%" });
    expect(short.notes[0]).toMatch(/Entrepôt.*Anciens soldes.*salaires exclus/);
  });

  it("shows culture totals and keeps step budgets constant for Vif", () => {
    const raw = fixture(), base = { ...raw.state.employees[0], skills: skills(10), trait: "quick" as const };
    const quick = getKqStaffBenefitPreview({ actor: base, kind: "culture", hours: 3, context: raw.context });
    expect(quick.metrics.slice(0, 2)).toEqual([{ label: "Étapes finançables", value: 6, unit: "étapes" }, { label: "Temps joueur épargnable", value: 3, unit: "h" }]);
    const meticulous = getKqStaffBenefitPreview({ actor: { ...base, trait: "meticulous" }, kind: "culture", hours: 3, context: raw.context });
    expect(meticulous.metrics.filter(row => row.label !== "Terpènes maximaux")).toEqual(quick.metrics.filter(row => row.label !== "Terpènes maximaux"));
    expect(meticulous.notes.join(" ")).toMatch(/différences.*arrondis et plafonds/);
  });

  it("caps audience forecasts without labelling offers as actual receipts", () => {
    const raw = fixture(); raw.context.instagramFollowers = 49_995;
    const preview = getKqStaffBenefitPreview({ actor: { skills: skills(10) }, kind: "communication", hours: 12, context: raw.context });
    expect(preview).toMatchObject({ title: "Bénéfice prévu" });
    expect(preview.metrics[0].value).toBe(5);
    expect(preview.notes.join(" ")).toMatch(/100 000.*aucune recette/);
  });

  it("uses the selected training skill and caps real XP at the maximum", () => {
    const raw = fixture(), actor = { ...raw.state.employees[0], trait: "learner" as const, skills: { ...skills(1), sales: 8000 } };
    expect(getKqStaffBenefitPreview({ actor, kind: "training", skill: "sales", hours: 7, context: raw.context }).metrics[0].value).toBe(100);
    expect(getKqStaffBenefitPreview({ actor, kind: "training", skill: "culture", hours: 2, context: raw.context }).metrics[0].value).toBe(150);
  });

  it("includes city attractiveness and versioned attempts", () => {
    const raw = fixture(), city = KQ_STAFF_CITIES[0];
    const employee = getKqStaffBenefitPreview({ actor: raw.state.employees[0], kind: "sales", hours: 7, cityId: city.id, context: raw.context });
    const player = getKqStaffBenefitPreview({ actor: { skills: skills(1) }, kind: "sales", hours: 12, cityId: city.id, context: raw.context });
    expect(employee.metrics[0].value).toBe(3); expect(player.metrics[0].value).toBe(6);
    delete raw.context.staffBenefitsVersion;
    expect(getKqStaffBenefitPreview({ actor: raw.state.employees[0], kind: "sales", hours: 7, context: raw.context }).metrics[0].value).toBe(1);
  });
});

describe("versioned prospecting missions", () => {
  it.each([2, 3.5, 4, 5.5, 6, 7])("offers floor(%s / 2) attempts for the same single travel charge", hours => {
    const raw = fixture(), city = KQ_STAFF_CITIES[0];
    const result = applyKqStaffCommand(raw, { action: "assign", employeeId: "employee", kind: "sales", hours, cityId: city.id, expectedCostCents: city.travelCents }, "sales-test");
    expect(result.debitCents).toBe(city.travelCents);
    expect(result.state.tasks[0].salesAttempts).toBe(Math.floor(hours / 2));
    expect(result.state.employees[0].workDays["1"].usedHours).toBe(hours);
    result.state.tasks[0].successChance = 100;
    const completed = advanceKqStaff({ ...raw, state: result.state, serverNow: at(1, 20) });
    expect(completed.effects.filter(effect => effect.kind === "sales")).toHaveLength(Math.floor(hours / 2));
    expect(completed.effects.every(effect => effect.kind !== "sales" || effect.shopPartners === 1 && effect.reputation === 5)).toBe(true);
    expect(completed.state.tasks[0].result).toMatchObject({ salesAttempts: Math.floor(hours / 2), partnersGained: Math.floor(hours / 2) });
    expect(advanceKqStaff({ ...raw, state: completed.state, serverNow: at(1, 21) }).effects).toEqual([]);
  });

  it("reserves twelve player hours for six attempts without increasing the travel charge", () => {
    const raw = fixture(), city = KQ_STAFF_CITIES[0];
    const result = applyKqStaffCommand(raw, { action: "player-assign", kind: "sales", hours: 12, cityId: city.id, expectedCostCents: city.travelCents }, "player-sales");
    expect(result.debitCents).toBe(city.travelCents); expect(result.state.tasks[0].salesAttempts).toBe(6);
    expect(result.state.playerWorkDays["1"].usedHours).toBe(12);
    result.state.tasks[0].successChance = 100;
    expect(advanceKqStaff({ ...raw, state: result.state, serverNow: at(1, 20) }).effects).toHaveLength(6);
  });

  it("keeps a previously accepted long mission at one attempt after upgrade", () => {
    const raw = fixture(), city = KQ_STAFF_CITIES[0]; delete raw.context.staffBenefitsVersion;
    const result = applyKqStaffCommand(raw, { action: "assign", employeeId: "employee", kind: "sales", hours: 7, cityId: city.id, expectedCostCents: city.travelCents }, "legacy-sales");
    expect(result.state.tasks[0].salesAttempts).toBeUndefined();
    result.state.tasks[0].successChance = 100;
    const complete = advanceKqStaff({ ...raw, context: { ...raw.context, staffBenefitsVersion: 1 }, state: result.state, serverNow: at(1, 20) });
    expect(complete.effects).toHaveLength(1); expect(complete.state.tasks[0].result?.salesAttempts).toBe(1);
  });
});

describe("explicit administration rules", () => {
  it.each(["culture", "processing", "communication", "administration"] as const)("keeps completed %s tasks compatible with pre-benefits SQL guards", kind => {
    const raw = fixture(); delete raw.context.staffBenefitsVersion;
    const started = applyKqStaffCommand(raw, { action: "assign", employeeId: "employee", kind, hours: .5 }, "legacy-task");
    const completed = advanceKqStaff({ ...raw, state: started.state, serverNow: at(2) });
    expect(completed.state.tasks[0].status).toBe("completed");
    expect(completed.state.tasks[0].result).toBeUndefined();
    const current = advanceKqStaff({ ...raw, context: { ...raw.context, staffBenefitsVersion: 1 }, state: started.state, serverNow: at(2) });
    expect(current.state.tasks[0].result?.version).toBe(1);
  });

  it("is absent by default and requires the server capability and an active employee", () => {
    const raw = fixture(); expect(raw.state.administrationRules).toBeUndefined();
    delete raw.context.staffBenefitsVersion;
    expect(() => applyKqStaffCommand(raw, rules, "rules")).toThrow(/mise à jour/);
    raw.context.staffBenefitsVersion = 1;
    expect(() => applyKqStaffCommand(raw, { ...rules, employeeId: "missing" }, "rules")).toThrow(/contrat actif/);
    raw.state.employees[0].status = "ended";
    expect(() => applyKqStaffCommand(raw, rules, "rules")).toThrow(/contrat actif/);
  });

  it("ignores client clocks, validates cents and never pays on configuration or TS settlement", () => {
    const raw = fixture(); raw.serverNow = at(1, 1);
    const parsed = parseKqStaffCommand({ ...rules, updatedAt: at(1), state: {} });
    expect(parsed).toEqual(rules);
    const result = applyKqStaffCommand(raw, parsed, "rules");
    expect(result.state.administrationRules).toEqual({ ...rules, action: undefined, updatedAt: at(1, 1) });
    expect(result.debitCents).toBe(0); expect(result.effects).toEqual([]);
    const unchanged = applyKqStaffCommand({ ...raw, state: result.state, serverNow: at(1, 2) }, rules, "rules-again");
    expect(unchanged.state.administrationRules?.updatedAt).toBe(at(1, 1));
    const changed = applyKqStaffCommand({ ...raw, state: result.state, serverNow: at(1, 2) }, { ...rules, cashReserveCents: 30_000 }, "rules-changed");
    expect(changed.state.administrationRules?.updatedAt).toBe(at(1, 2));
    expect(advanceKqStaff({ ...raw, state: changed.state, serverNow: at(1, 3) }).debitCents).toBe(0);
  });

  it.each([
    { maxDailyCents: .5 }, { cashReserveCents: -1 }, { maxDailyCents: 100_000_001 }, { cashReserveCents: Infinity },
    { supplierDueDays: 8 }, { supplierDueDays: .5 }, { payPayroll: "yes" }, { enabled: "true" },
    { employeeId: null }, { maxDailyCents: 0 }, { paySuppliers: false, payPayroll: false },
  ])("rejects malformed or unbounded rules %j", patch => {
    expect(() => parseKqStaffCommand({ ...rules, ...patch })).toThrow(/invalides/);
  });

  it("allows explicit disabling without a worker or any spending allowance", () => {
    const raw = fixture();
    const disabled = { ...rules, enabled: false, employeeId: null, maxDailyCents: 0, paySuppliers: false, payPayroll: false };
    const result = applyKqStaffCommand(raw, disabled, "disable");
    expect(result.debitCents).toBe(0); expect(result.state.administrationRules?.enabled).toBe(false);
    expect(isKqStaffState(result.state)).toBe(true);
  });

  it("allows only the designated payroll administrator to work while salaries are due", () => {
    const raw = fixture(); raw.state = applyKqStaffCommand(raw, rules, "rules").state;
    raw.state.payroll.push({ id: "due", employeeId: "employee", dueAt: at(1), grossCents: 100, employerCents: 0, indemnityCents: 0, totalCents: 100, paidCents: 0 });
    expect(canKqStaffAssignWithOutstandingPayroll(raw.state, "employee", "administration")).toBe(true);
    expect(canKqStaffAssignWithOutstandingPayroll(raw.state, "employee", "sales")).toBe(false);
    const started = applyKqStaffCommand(raw, { action: "assign", employeeId: "employee", kind: "administration", hours: .5 }, "admin");
    expect(started.state.tasks).toHaveLength(1); expect(started.state.payroll[0].paidCents).toBe(0);
    expect(() => applyKqStaffCommand(raw, { action: "assign", employeeId: "employee", kind: "communication", hours: .5 }, "blocked")).toThrow(/salaires/);
    raw.state.administrationRules!.payPayroll = false;
    expect(() => applyKqStaffCommand(raw, { action: "assign", employeeId: "employee", kind: "administration", hours: .5 }, "blocked-admin")).toThrow(/salaires/);
  });

  it("starts the payroll administrative weekly slot while skipping other unpaid work", () => {
    const raw = fixture(); raw.state = applyKqStaffCommand(raw, rules, "rules").state;
    const days: KqStaffPlannedTask[][] = [[], [{ kind: "administration", hours: .5 }, { kind: "communication", hours: .5 }], [], [], []];
    raw.state = applyKqStaffCommand(raw, { action: "set-weekly-plan", employeeId: "employee", enabled: true, days, expectedWeeklyCostCents: 0 }, "plan").state;
    raw.state.payroll.push({ id: "due", employeeId: "employee", dueAt: at(1), grossCents: 100, employerCents: 0, indemnityCents: 0, totalCents: 100, paidCents: 0 });
    const result = advanceKqStaff({ ...raw, serverNow: at(2) });
    expect(result.state.tasks).toHaveLength(1); expect(result.state.tasks[0].kind).toBe("administration");
    expect(result.state.employees[0].weeklyPlan?.history[0]).toMatchObject({ started: 1, skipped: 1 });
    expect(result.state.payroll[0].paidCents).toBe(0);
  });

  it("does not discard a later payroll-administration slot when an earlier day has unpaid wages", () => {
    const raw = fixture(); raw.state = applyKqStaffCommand(raw, rules, "rules").state;
    const days: KqStaffPlannedTask[][] = [[], [{ kind: "communication", hours: .5 }], [{ kind: "administration", hours: .5 }], [], []];
    raw.state = applyKqStaffCommand(raw, { action: "set-weekly-plan", employeeId: "employee", enabled: true, days, expectedWeeklyCostCents: 0 }, "plan").state;
    raw.state.payroll.push({ id: "due", employeeId: "employee", dueAt: at(1), grossCents: 100, employerCents: 0, indemnityCents: 0, totalCents: 100, paidCents: 0 });
    const result = advanceKqStaff({ ...raw, serverNow: at(3) });
    expect(result.state.tasks).toHaveLength(1); expect(result.state.tasks[0]).toMatchObject({ day: 3, kind: "administration" });
  });
});
