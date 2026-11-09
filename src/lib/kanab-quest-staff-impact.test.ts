import { describe, expect, it } from "vitest";
import { createKqStaffState, KQ_STAFF_CANDIDATES, projectKqStaffSnapshot } from "./kanab-quest-staff";
import { getKqStaffImpact, KQ_STAFF_IMPACT_SECTORS, type KqStaffImpact, type KqStaffImpactSectorId } from "./kanab-quest-staff-impact";
import type { KqStaffEmployee, KqStaffPlannedTask, KqStaffSnapshot, KqStaffTask } from "./kanab-quest-staff-types";

const NOW = "2026-11-09T12:00:00Z";
function employee(id: string, extra: Partial<KqStaffEmployee> = {}): KqStaffEmployee {
  return { ...structuredClone(KQ_STAFF_CANDIDATES[0]), id, name: id, contract: "cdi", weeklyHours: 35,
    hiredAt: NOW, endsAt: null, reason: "permanent", status: "active", nextPayrollAt: NOW, paidUntil: NOW,
    grossEarnedCents: 0, overtimeGrossCents: 0, finalPaid: false, workDays: {}, leave: [], completedTasks: 0,
    trait: "organized", skills: { culture: 1600, processing: 1600, administration: 1600, sales: 1600, communication: 1600 }, ...extra };
}
function fixture(): KqStaffSnapshot {
  const state = createKqStaffState(NOW);
  state.employees = [employee("anna"), employee("mael")];
  return projectKqStaffSnapshot({ state, revision: 0, serverNow: NOW, cashCents: 1_000_000,
    context: { businessStartedAt: NOW, reputation: 0, instagramFollowers: 0, shopPartners: 0,
      activeRuns: [], processingBatches: [], supplierInvoices: [], cultureWorkVersion: 1,
      processingWorkVersion: 1, trimQueueVersion: 2, weeklyPlanVersion: 1, staffBenefitsVersion: 1 } });
}
function task(kind: KqStaffTask["kind"], extra: Partial<KqStaffTask> = {}): KqStaffTask {
  return { id: `${kind}-task`, employeeId: "anna", kind, skill: kind === "trim" ? "processing" : kind === "training" ? "culture" : kind === "countryside" ? "sales" : kind,
    hours: 2, startedAt: NOW, completesAt: "2026-11-09T13:00:00Z", day: 1, status: "running", trainingCostCents: 0, skillLevel: 5, ...extra };
}
function plan(days: KqStaffPlannedTask[][], enabled = true): KqStaffEmployee["weeklyPlan"] {
  return { days: [...days, ...Array.from({ length: 5 - days.length }, () => [])], enabled, updatedAt: NOW,
    nextDay: 2, weeklyCostCents: days.flat().reduce((sum, row) => sum + (row.costCents ?? 0), 0), history: [] };
}
const sector = (impact: KqStaffImpact, id: KqStaffImpactSectorId) => impact.sectors.find(row => row.id === id)!;

describe("staff impact dashboard", () => {
  it("separates mixed daily assignments from historical, player and weekly tasks", () => {
    const snapshot = fixture();
    snapshot.state.tasks = [task("culture", { hours: 3, cultureShift: true, cultureUsedHours: 1 }),
      task("processing", { hours: 2, processingShift: true, processingUsedHours: .5 }),
      task("communication", { employeeId: "mael", hours: 2 }), task("training", { hours: 2, status: "completed", result: { version: 1, xpGained: 120 } }),
      task("sales", { day: 2, hours: 7 }), task("administration", { employeeId: "player", hours: 7 })];
    snapshot.state.employees[0].weeklyPlan = plan([[{ kind: "trim", hours: 7, costCents: 0 }]]);
    const impact = getKqStaffImpact(snapshot, { mode: "day" });
    expect(impact.sectors.map(row => row.id)).toEqual(KQ_STAFF_IMPACT_SECTORS);
    expect(impact.hours).toEqual({ total: 9, completed: 3.5, running: 2, remaining: 3.5, unused: 0, unknown: 0 });
    expect(sector(impact, "trim").hours.total).toBe(0);
    expect(sector(impact, "culture").actual).toContainEqual(expect.objectContaining({ id: "culture-hours", value: 1 }));
    expect(sector(impact, "culture").forecast).toContainEqual(expect.objectContaining({ id: "steps", value: 4 }));
    expect(sector(impact, "processing").forecast).toContainEqual(expect.objectContaining({ id: "reserved-hours", value: 1.5 }));
    expect(getKqStaffImpact(snapshot, { mode: "day", employeeId: "mael" }).hours.total).toBe(2);
  });

  it("counts unused closed reservations separately without forecasting them again", () => {
    const snapshot = fixture();
    snapshot.state.tasks = [task("culture", { hours: 3, cultureShift: true, cultureUsedHours: 1,
      status: "completed", result: { version: 1, cultureUsedHours: 1 } })];
    const impact = getKqStaffImpact(snapshot, { mode: "day" });
    expect(impact.hours).toMatchObject({ total: 3, completed: 1, unused: 2, remaining: 0 });
    expect(sector(impact, "culture").forecast).toEqual([]);
  });

  it("keeps missing reservation consumption unknown rather than zero or available", () => {
    const snapshot = fixture();
    snapshot.state.tasks = [task("culture", { cultureShift: true })];
    const impact = getKqStaffImpact(snapshot, { mode: "day" });
    expect(impact.hours).toMatchObject({ total: 2, completed: 0, remaining: 0, unknown: 2 });
    expect(sector(impact, "culture").actual[0].value).toBeNull();
    expect(sector(impact, "culture").forecast).toEqual([]);
    expect(sector(impact, "culture").warnings.join(" ")).toMatch(/Consommation.*indisponible/);
  });

  it("does not promise a remaining budget after the reservation expires while settlement is pending", () => {
    const snapshot = fixture(); snapshot.serverNow = "2026-11-09T14:00:00Z";
    snapshot.state.tasks = [task("processing", { hours: 3, processingShift: true, processingUsedHours: 1 })];
    const impact = getKqStaffImpact(snapshot, { mode: "day" });
    expect(impact.hours).toMatchObject({ total: 3, completed: 1, unused: 2, remaining: 0 });
    expect(sector(impact, "processing").forecast).toEqual([]);
    expect(sector(impact, "processing").notes.join(" ")).toMatch(/clôture serveur en attente/);
    expect(sector(impact, "processing").warnings.join(" ")).toMatch(/clôture serveur en attente/);
  });

  it("does not replace missing per-task receipts with global cumulative benefits", () => {
    const snapshot = fixture();
    snapshot.state.tasks = [task("sales", { status: "completed" }), task("communication", { status: "completed", result: { version: 1, followersOffered: 500 } })];
    snapshot.benefits = { trackedSince: NOW, supplierSavingsCents: 9000, supplierBaseCents: 10000, supplierNetCents: 1000,
      discountedInvoices: 5, followersGained: 1200, partnersGained: 30, invoicesPaidCount: 5, invoicesPaidCents: 100,
      payrollPaidCount: 0, payrollPaidCents: 0, cultureHoursDelegated: 80, processingHoursDelegated: 40,
      processingSecondsSaved: 0, trimGrams: 500, lastBenefitAt: NOW, lastAdministration: null };
    const impact = getKqStaffImpact(snapshot, { mode: "day" });
    expect(sector(impact, "sales").actual.find(row => row.id === "partners")?.value).toBeNull();
    expect(sector(impact, "communication").actual.find(row => row.id === "followers-gained")?.value).toBeNull();
    expect(sector(impact, "communication").actual.find(row => row.id === "followers-offered")?.value).toBe(500);
    expect(sector(impact, "communication").forecast).toEqual([]);
  });

  it("requires every matching receipt before showing an aggregated actual count", () => {
    const snapshot = fixture();
    snapshot.state.tasks = [task("sales", { id: "known", status: "completed", result: { version: 1, salesAttempts: 3, partnersGained: 2 } }),
      task("sales", { id: "unknown", employeeId: "mael", status: "completed" })];
    expect(sector(getKqStaffImpact(snapshot, { mode: "day" }), "sales").actual.find(row => row.id === "partners")?.value).toBeNull();
    expect(sector(getKqStaffImpact(snapshot, { mode: "day", employeeId: "anna" }), "sales").actual.find(row => row.id === "partners")?.value).toBe(2);
  });

  it("uses only enabled plans on active contracts and retains paused employees as filters", () => {
    const snapshot = fixture();
    snapshot.state.employees[0].weeklyPlan = plan([[{ kind: "culture", hours: 3, costCents: 0 }], [{ kind: "communication", hours: 2, costCents: 0 }]]);
    snapshot.state.employees[1].weeklyPlan = plan([[{ kind: "processing", hours: 7, costCents: 0 }]], false);
    snapshot.state.employees.push(employee("ended", { status: "ended", weeklyPlan: plan([[{ kind: "sales", hours: 7, costCents: 0 }]]) }));
    snapshot.state.tasks = [task("trim", { hours: 7 })];
    const impact = getKqStaffImpact(snapshot, { mode: "week" });
    expect(impact.hours).toMatchObject({ total: 5, remaining: 5, completed: 0, running: 0 });
    expect(impact).toMatchObject({ activePlans: 1, pausedPlans: 1 });
    expect(impact.employees.map(row => [row.employeeId, row.hours.total])).toEqual([["anna", 5], ["mael", 0]]);
    expect(impact.sectors.every(row => row.actual.length === 0)).toBe(true);
    expect(sector(impact, "culture").notes.join(" ")).toMatch(/Aucune culture compatible/);
    expect(impact.notes.join(" ")).toMatch(/ni.*réalisée.*ni.*promesse/);
  });

  it("keeps weekly plan leave, contract, payroll, cash and equipment gates explicit", () => {
    const snapshot = fixture(); snapshot.cashCents = 100; snapshot.outstandingCents = 500;
    snapshot.state.employees[0].endsAt = "2026-11-10T12:00:00Z";
    snapshot.state.employees[0].leave = [{ id: "leave", startDay: 2, endDay: 3, days: 2 }];
    snapshot.state.employees[0].weeklyPlan = plan([[{ kind: "trim", trimMode: "machine", hours: 2, costCents: 0 }], [{ kind: "training", skill: "culture", hours: 2, costCents: 7000 }]]);
    const impact = getKqStaffImpact(snapshot, { mode: "week" });
    expect(sector(impact, "trim").notes.join(" ")).toMatch(/congé.*fin du contrat.*Salaires échus.*machine commune.*Aucune récolte/);
    expect(sector(impact, "training").notes.join(" ")).toMatch(/Trésorerie actuelle insuffisante/);
    expect(impact.notes.join(" ")).toMatch(/hors salaires/);
    expect(impact.sectors.flatMap(row => row.actual)).toEqual([]);
    expect(sector(impact, "trim").warnings.join(" ")).toMatch(/congé.*fin du contrat.*Salaires échus.*machine commune.*Aucune récolte/);
    expect(sector(impact, "training").warnings.join(" ")).toMatch(/Trésorerie actuelle insuffisante/);
  });

  it("separates availability warnings from formulas while retaining every detailed note", () => {
    const snapshot = fixture();
    snapshot.state.employees[0].weeklyPlan = plan([[{ kind: "culture", hours: 3, costCents: 0 }], [{ kind: "administration", hours: .5, costCents: 0 }]]);
    const impact = getKqStaffImpact(snapshot, { mode: "week" });
    const culture = sector(impact, "culture");
    expect(culture.warnings).toEqual([expect.stringMatching(/Aucune culture compatible/)]);
    expect(culture.notes.join(" ")).toMatch(/arrondis et plafonds/);
    expect(culture.warnings.join(" ")).not.toMatch(/arrondis et plafonds/);
    expect(culture.contributions[0].warnings).toEqual(culture.warnings);
    const administration = sector(impact, "administration");
    expect(administration.warnings).toEqual([expect.stringMatching(/Paiements délégués non autorisés/)]);
    expect(administration.notes.join(" ")).toMatch(/remises ne s’additionnent pas/);
    expect(administration.warnings.every(warning => administration.notes.includes(warning))).toBe(true);
  });

  it("uses accepted task levels and chances after an employee gains levels", () => {
    const snapshot = fixture();
    snapshot.state.employees[0].skills.processing = 8100;
    snapshot.state.tasks = [task("processing", { processingShift: true, processingUsedHours: .5, skillLevel: 1 }),
      task("sales", { skillLevel: 1, successChance: 17, hours: 7 })];
    const impact = getKqStaffImpact(snapshot, { mode: "day" });
    expect(sector(impact, "processing").forecast.find(row => row.id === "efficiency")?.value).toBe(55);
    expect(sector(impact, "sales").forecast.find(row => row.id === "chance")?.value).toBe(17);
    expect(sector(impact, "sales").forecast.find(row => row.id === "attempts")?.value).toBe(1);
  });

  it("does not apply a versatile level boost twice to historical missions", () => {
    const snapshot = fixture(); snapshot.state.employees[0].trait = "versatile";
    snapshot.state.tasks = [task("processing", { processingShift: true, processingUsedHours: 0, skillLevel: 5 })];
    expect(sector(getKqStaffImpact(snapshot, { mode: "day" }), "processing").forecast.find(row => row.id === "efficiency")?.value).toBe(75);
  });

  it("caps the shared audience forecast and never adds discounts or rates", () => {
    const snapshot = fixture(); snapshot.context.instagramFollowers = 49_995;
    snapshot.state.employees[1].skills.processing = 8100;
    for (const worker of snapshot.state.employees) worker.weeklyPlan = plan([
      [{ kind: "communication", hours: 7, costCents: 0 }], [{ kind: "administration", hours: 7, costCents: 0 }], [{ kind: "processing", hours: 7, costCents: 0 }],
    ]);
    const impact = getKqStaffImpact(snapshot, { mode: "week" });
    expect(sector(impact, "communication").forecast.find(row => row.id === "followers-capacity")?.value).toBe(5);
    expect(sector(impact, "administration").forecast.find(row => row.id === "discount")?.value).toBe(6);
    expect(sector(impact, "administration").forecast.find(row => row.id === "validity")?.value).toBe(7);
    expect(sector(impact, "processing").forecast.find(row => row.id === "efficiency")).toMatchObject({ value: null, min: 75, max: 100 });
  });

  it("caps repeated training per employee and skill without adding final levels", () => {
    const snapshot = fixture(); snapshot.state.employees[0].skills.culture = 8000;
    snapshot.state.employees[0].weeklyPlan = plan([
      [{ kind: "training", skill: "culture", hours: 2, costCents: 7000 }], [{ kind: "training", skill: "culture", hours: 2, costCents: 7000 }],
      [{ kind: "training", skill: "sales", hours: 2, costCents: 7000 }],
    ]);
    const training = sector(getKqStaffImpact(snapshot, { mode: "week" }), "training");
    expect(training.forecast.find(row => row.id === "xp-culture")?.value).toBe(100);
    expect(training.forecast.find(row => row.id === "xp-sales")?.value).toBe(120);
    expect(training.forecast.find(row => row.id === "level-culture")?.value).toBe(10);
  });

  it("projects culture bonuses from cumulative differences instead of refreshing their caps", () => {
    const snapshot = fixture();
    snapshot.state.employees[0].role = "grower"; snapshot.state.employees[0].trait = "meticulous";
    snapshot.state.tasks = [task("culture", { hours: 7, cultureShift: true, cultureUsedHours: 3.5, skillLevel: 10 })];
    const culture = sector(getKqStaffImpact(snapshot, { mode: "day" }), "culture");
    expect(culture.forecast.find(row => row.id === "vitality")?.value).toBe(3);
    expect(culture.forecast.find(row => row.id === "terpenes")?.value).toBe(0);
    expect(culture.forecast.find(row => row.id === "yield")?.value).toBe(0);
    expect(culture.forecast.find(row => row.id === "cannabinoids")?.value).toBe(1);
    expect(culture.forecast.find(row => row.id === "steps")?.value).toBe(7);
    expect(culture.forecast.find(row => row.id === "terpenes")?.note).toMatch(/plafonds.*jouer les étapes.*ne s’additionnent pas/);
  });

  it("keeps weekly culture maxima per reservation and shows experience, traits and roles", () => {
    const snapshot = fixture();
    snapshot.state.employees[0].role = "grower"; snapshot.state.employees[0].trait = "meticulous";
    snapshot.state.employees[0].skills.culture = 8100;
    snapshot.state.employees[1].role = "worker"; snapshot.state.employees[1].skills.culture = 0;
    for (const worker of snapshot.state.employees) worker.weeklyPlan = plan([
      [{ kind: "culture", hours: 3, costCents: 0 }], [{ kind: "culture", hours: 3, costCents: 0 }],
    ]);
    const culture = sector(getKqStaffImpact(snapshot, { mode: "week" }), "culture");
    expect(culture.forecast.find(row => row.id === "vitality")?.value).toBe(3);
    expect(culture.forecast.find(row => row.id === "terpenes")).toMatchObject({ value: null, min: 0, max: 4 });
    expect(culture.forecast.find(row => row.id === "yield")).toMatchObject({ value: null, min: 0, max: 1 });
    expect(culture.forecast.find(row => row.id === "cannabinoids")).toMatchObject({ value: null, min: 0, max: 3 });
    expect(culture.forecast.find(row => row.id === "steps")?.value).toBe(24);
  });

  it("does not add communication reputation or multiply trim quality across workers and missions", () => {
    const snapshot = fixture();
    snapshot.state.employees[0].skills.processing = 8100;
    snapshot.state.employees[1].skills.processing = 0;
    for (const worker of snapshot.state.employees) worker.weeklyPlan = plan([
      [{ kind: "communication", hours: 7, costCents: 0 }], [{ kind: "communication", hours: 7, costCents: 0 }],
      [{ kind: "trim", trimMode: worker.id === "anna" ? "manual" : "machine", hours: 3, costCents: 0 }],
    ]);
    const impact = getKqStaffImpact(snapshot, { mode: "week" });
    expect(sector(impact, "communication").forecast.find(row => row.id === "reputation-proposed")?.value).toBe(9);
    expect(sector(impact, "trim").forecast.find(row => row.id === "trim-quality")).toMatchObject({ value: null, min: -3, max: 3 });
    snapshot.state.tasks = [task("trim", { trimQueue: true, trimRateGramsPerHour: 100, trimQualityDelta: -2, skillLevel: 10 })];
    expect(sector(getKqStaffImpact(snapshot, { mode: "day" }), "trim").forecast.find(row => row.id === "trim-quality")?.value).toBe(-2);
  });

  it("shows administrative document capacity only for the explicitly authorized employee", () => {
    const snapshot = fixture();
    for (const worker of snapshot.state.employees) worker.weeklyPlan = plan([
      [{ kind: "administration", hours: .5, costCents: 0 }], [{ kind: "administration", hours: 2, costCents: 0 }],
    ]);
    snapshot.state.administrationRules = { enabled: true, employeeId: "anna", paySuppliers: true, payPayroll: false,
      maxDailyCents: 10000, cashReserveCents: 2000, supplierDueDays: 2, updatedAt: NOW };
    const administration = sector(getKqStaffImpact(snapshot, { mode: "week" }), "administration");
    expect(administration.forecast.find(row => row.id === "documents-capacity")).toMatchObject({ value: null, min: 1, max: 4 });
    expect(administration.forecast.find(row => row.id === "documents-capacity")?.note).toMatch(/plafond quotidien.*réserve.*éligibles.*intégraux/);
    expect(administration.contributions.filter(row => row.employeeId === "mael").every(row => row.forecast.every(item => item.id !== "documents-capacity"))).toBe(true);
    expect(administration.notes.join(" ")).toMatch(/Paiements délégués non autorisés pour ce salarié/);
    snapshot.state.administrationRules.enabled = false;
    expect(sector(getKqStaffImpact(snapshot, { mode: "week" }), "administration").forecast.some(row => row.id === "documents-capacity")).toBe(false);
  });

  it("does not retroactively authorize administrative missions that started before the rules", () => {
    const snapshot = fixture();
    snapshot.state.tasks = [task("administration")];
    snapshot.state.administrationRules = { enabled: true, employeeId: "anna", paySuppliers: false, payPayroll: true,
      maxDailyCents: 10000, cashReserveCents: 2000, supplierDueDays: 2, updatedAt: "2026-11-09T12:01:00Z" };
    expect(sector(getKqStaffImpact(snapshot, { mode: "day" }), "administration").forecast.some(row => row.id === "documents-capacity")).toBe(false);
    snapshot.state.administrationRules.updatedAt = NOW;
    expect(sector(getKqStaffImpact(snapshot, { mode: "day" }), "administration").forecast.find(row => row.id === "documents-capacity")?.value).toBe(4);
  });

  it("keeps legacy processing in its original mode instead of projecting a new reservation", () => {
    const snapshot = fixture(); snapshot.state.tasks = [task("processing", { skillLevel: 1 })];
    const processing = sector(getKqStaffImpact(snapshot, { mode: "day" }), "processing");
    expect(processing.forecast.find(row => row.id === "seconds")?.value).toBe(90);
    expect(processing.forecast.some(row => row.id === "efficiency")).toBe(false);
  });

  it("separates recorded trim grams from the capacity in the remaining time", () => {
    const snapshot = fixture();
    snapshot.serverNow = "2026-11-09T12:30:00Z";
    snapshot.state.tasks = [task("trim", { trimQueue: true, trimRateGramsPerHour: 100, trimGrams: 80 })];
    const trim = sector(getKqStaffImpact(snapshot, { mode: "day" }), "trim");
    expect(trim.actual.find(row => row.id === "trim-grams")?.value).toBe(80);
    expect(trim.forecast.find(row => row.id === "trim-capacity")?.value).toBe(100);
    snapshot.serverNow = "2026-11-09T14:00:00Z";
    const expired = sector(getKqStaffImpact(snapshot, { mode: "day" }), "trim");
    expect(expired.hours.running).toBe(2);
    expect(expired.forecast.find(row => row.id === "trim-capacity")?.value).toBe(0);
    expect(expired.actual.find(row => row.id === "trim-grams")?.value).toBe(80);
  });

  it("does not mutate saved tasks, plans, skills or global receipts", () => {
    const snapshot = fixture();
    snapshot.state.employees[0].weeklyPlan = plan([[{ kind: "training", skill: "culture", hours: 2, costCents: 7000 }]]);
    snapshot.state.tasks = [task("communication")];
    const before = structuredClone(snapshot);
    getKqStaffImpact(snapshot, { mode: "week" }); getKqStaffImpact(snapshot, { mode: "day" });
    expect(snapshot).toEqual(before);
  });
});
