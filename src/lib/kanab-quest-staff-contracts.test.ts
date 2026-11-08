import { describe, expect, it } from "vitest";
import { KQ_GAME_DAY_MS, KQ_GAME_MONTH_MS } from "./kanab-quest-business";
import { advanceKqStaff, applyKqStaffCommand, createKqStaffState, getKqStaffCalendar, getKqStaffCapacity, getKqStaffExtraQuote, getKqStaffLeave, getKqStaffMonthlyCost, isKqStaffState, KQ_STAFF_CANDIDATES, parseKqStaffCommand } from "./kanab-quest-staff";
import { getKqStaffContractCooldown, getKqStaffContractOptions, getKqStaffPersonId, getKqStaffRehireBlock, getKqStaffRoleContractBlock } from "./kanab-quest-staff-contracts";
import type { KqStaffCommand, KqStaffContractKind, KqStaffEmployee, KqStaffRawSnapshot, KqStaffState } from "./kanab-quest-staff-types";

// The game calendar remains elapsed time across the real autumn DST change.
const START = Date.parse("2026-10-24T22:00:00Z");
const iso = (value: number) => new Date(value).toISOString();
const atDay = (index: number) => iso(START + index * KQ_GAME_DAY_MS);
const atMonth = (month: number) => iso(START + month * KQ_GAME_MONTH_MS);
const candidate = KQ_STAFF_CANDIDATES[0];
const monthlyCost = getKqStaffMonthlyCost(candidate, 35).totalCents;
function raw(state: KqStaffState | null = null, serverNow = atDay(0)): KqStaffRawSnapshot {
  return { state, revision: 0, serverNow, archiveCount: 0, cashCents: 100_000_000,
    context: { businessStartedAt: atDay(0), reputation: 0, instagramFollowers: 0, shopPartners: 0,
      activeRuns: [], processingBatches: [], supplierInvoices: [], contractLifecycleVersion: 1, contractCooldowns: {}, weeklyPlanVersion: 1 } };
}
function hire(contract: KqStaffContractKind = "cdd", durationMonths = 3) {
  return applyKqStaffCommand(raw(), { action: "hire", candidateCode: candidate.code, contract, durationMonths,
    weeklyHours: 35, reason: contract === "cdi" ? "permanent" : contract === "seasonal" ? "harvest" : "temporary-increase",
    expectedMonthlyCostCents: monthlyCost }, "contract-1").state;
}
function renew(employee: KqStaffEmployee, months: number): Extract<KqStaffCommand, { action: "renew-contract" }> {
  return { action: "renew-contract", employeeId: employee.id, months, expectedEndsAt: employee.endsAt!, expectedMonthlyCostCents: monthlyCost };
}
function convert(employee: KqStaffEmployee): Extract<KqStaffCommand, { action: "convert-cdi" }> {
  return { action: "convert-cdi", employeeId: employee.id, expectedEndsAt: employee.endsAt!, expectedMonthlyCostCents: monthlyCost };
}
function rehire(source: KqStaffEmployee, contract: KqStaffContractKind = "cdi"): Extract<KqStaffCommand, { action: "rehire" }> {
  return { action: "rehire", sourceContractId: source.id, contract, durationMonths: contract === "cdi" ? 0 : 3,
    weeklyHours: 35, reason: contract === "cdi" ? "permanent" : contract === "seasonal" ? "harvest" : "temporary-increase",
    expectedMonthlyCostCents: getKqStaffMonthlyCost(source, 35).totalCents };
}
function finish(state = hire(), serverNow = state.employees[0].endsAt!) {
  const ended = advanceKqStaff(raw(state, serverNow)).state;
  const expectedCents = ended.payroll.reduce((sum, pay) => sum + pay.totalCents - pay.paidCents, 0);
  return applyKqStaffCommand(raw(ended, serverNow), { action: "payroll", expectedCents }, "pay-final").state;
}
function archivedSource(): KqStaffEmployee {
  const source = structuredClone(finish().employees[0]);
  // Expiry within a working game day exercises same-day person-hour continuity.
  source.hiredAt = atDay(9.5); source.endsAt = atDay(99.5); source.paidUntil = source.endsAt;
  source.skills = { culture: 1234, processing: 6789, communication: 345, sales: 8100, administration: 4321 };
  source.portraitCode = "anna"; source.completedTasks = 27;
  source.workDays = { "100": { usedHours: 10, extraHours: 3 } };
  return source;
}
function trimFixture(snapshot: KqStaffRawSnapshot, employeeId: string | null) {
  snapshot.context.trimQueueVersion = 2;
  snapshot.context.trimLots = [{ flowerId: "trim-lot", name: "Récolte", requiredWork: 6, completedWork: 0,
    totalGrams: 1000, completedGrams: 0, createdAt: snapshot.serverNow, mode: null, completedAt: null }];
  snapshot.state = applyKqStaffCommand(snapshot, { action: "trim", employeeId, hours: 2, mode: "manual", expectedCostCents: 0 }, "running-trim").state;
  return snapshot;
}
function settleTrim(snapshot: KqStaffRawSnapshot, serverNow: string) {
  snapshot.serverNow = serverNow;
  const result = advanceKqStaff(snapshot);
  snapshot.state = result.state;
  for (const effect of result.effects) if (effect.kind === "trim-work") {
    const lot = snapshot.context.trimLots!.find(lot => lot.flowerId === effect.flowerId)!;
    lot.completedGrams! += effect.work; lot.completedWork = lot.completedGrams! / lot.totalGrams! * 6; lot.mode = effect.mode;
  }
  return result;
}

describe("contract renewal and conversion quotes", () => {
  it("keeps metadata-free existing contracts compatible", () => {
    const state = hire(); delete state.employees[0].personId; delete state.employees[0].renewals;
    expect(isKqStaffState(state)).toBe(true);
    expect(getKqStaffPersonId(state.employees[0])).toBe("contract-1");
    expect(getKqStaffContractOptions(state.employees[0], atDay(1))).toMatchObject({ renewalCount: 0, maxRenewals: 2, totalMonths: 3, maxMonths: 18, remainingMonths: 15, canRenew: true, canConvert: true });
  });
  it("allows no renewal at the exclusive deadline or on a CDI", () => {
    const employee = hire().employees[0];
    expect(getKqStaffContractOptions(employee, employee.endsAt!)).toMatchObject({ canRenew: false, canConvert: false });
    expect(getKqStaffContractOptions(hire("cdi", 0).employees[0], atDay(1))).toMatchObject({ canRenew: false, canConvert: false, maxMonths: 0 });
  });
  it("preserves the contract, pay, leave, XP, hours and weekly plan during renewal", () => {
    const state = hire(); const employee = state.employees[0];
    employee.skills.processing = 1234;
    employee.leave = [{ id: "leave-1", startDay: 3, endDay: 3, days: 1 }];
    employee.workDays = { "1": { usedHours: 2, extraHours: 1 } };
    employee.overtimeGrossCents = 1354;
    employee.weeklyPlan = { enabled: false, days: [[], [], [], [], []], nextDay: 2, updatedAt: atDay(0), weeklyCostCents: 0, history: [] };
    const original = structuredClone(state);
    const result = applyKqStaffCommand(raw(state, atDay(1)), renew(employee, 6), "renew-request");
    expect(result.debitCents).toBe(0); expect(result.effects).toEqual([]); expect(state).toEqual(original);
    expect(result.state.employees[0]).toEqual({ ...original.employees[0], endsAt: atMonth(9), renewals: [{ at: atDay(1), previousEndsAt: atMonth(3), endsAt: atMonth(9) }] });
    expect(result.state.payroll).toEqual(original.payroll);
  });
  it("issues continuing payroll at the original monthly dates and no indemnity at the old end", () => {
    let state = hire();
    state = applyKqStaffCommand(raw(state, atDay(1)), renew(state.employees[0], 3), "renew").state;
    state = advanceKqStaff(raw(state, atMonth(3))).state;
    expect(state.employees[0]).toMatchObject({ status: "active", hiredAt: atDay(0), paidUntil: atMonth(3), nextPayrollAt: atMonth(4), finalPaid: false });
    expect(state.payroll.map(pay => pay.dueAt)).toEqual([atMonth(1), atMonth(2), atMonth(3)]);
    expect(state.payroll.every(pay => pay.indemnityCents === 0)).toBe(true);
    expect(state.payroll.some(pay => pay.id === "contract-1:end")).toBe(false);
    const closed = advanceKqStaff(raw(state, atMonth(6))).state;
    expect(closed.payroll.filter(pay => pay.id === "contract-1:end")).toHaveLength(1);
    expect(closed.employees[0].status).toBe("ended");
    expect(advanceKqStaff(raw(closed, atMonth(7))).state.payroll).toEqual(closed.payroll);
  });
  it("caps renewal count at two independently of duration, with CDI still available", () => {
    let state = hire();
    for (let index = 1; index <= 2; index++) state = applyKqStaffCommand(raw(state, atDay(index)), renew(state.employees[0], 1), `renew-${index}`).state;
    expect(getKqStaffContractOptions(state.employees[0], atDay(3))).toMatchObject({ renewalCount: 2, remainingMonths: 13, canRenew: false, canConvert: true });
    expect(() => applyKqStaffCommand(raw(state, atDay(3)), renew(state.employees[0], 1), "third")).toThrow(/deux renouvellements/);
    expect(applyKqStaffCommand(raw(state, atDay(3)), convert(state.employees[0]), "cdi").state.employees[0].contract).toBe("cdi");
  });
  it.each([["cdd", 12, 6, 18], ["seasonal", 3, 3, 6]] as const)("caps %s total duration from the initial hire", (kind, initial, extension, maximum) => {
    const state = hire(kind, initial);
    expect(() => applyKqStaffCommand(raw(state, atDay(1)), renew(state.employees[0], extension + 1), "too-long")).toThrow(/durée totale/);
    const result = applyKqStaffCommand(raw(state, atDay(1)), renew(state.employees[0], extension), "maximum");
    expect(result.state.employees[0].endsAt).toBe(atMonth(maximum));
    expect(getKqStaffContractOptions(result.state.employees[0], atDay(2))).toMatchObject({ canRenew: false, canConvert: true, remainingMonths: 0 });
  });
  it("rejects stale dates, changed prices, fractional durations and late amendments atomically", () => {
    const state = hire(), before = structuredClone(state), command = renew(state.employees[0], 3);
    for (const invalid of [{ ...command, expectedEndsAt: atMonth(6) }, { ...command, expectedMonthlyCostCents: 1 }, { ...command, months: 1.5 }, { ...command, months: 0 }]) expect(() => applyKqStaffCommand(raw(state, atDay(1)), invalid, "bad")).toThrow();
    expect(() => applyKqStaffCommand(raw(state, atMonth(3)), command, "late")).toThrow(/avant la fin/);
    expect(() => applyKqStaffCommand(raw(state, atMonth(3)), convert(state.employees[0]), "late-cdi")).toThrow(/avant la fin/);
    expect(state).toEqual(before);
  });
  it("converts before expiry while carrying accrued leave, salary and renewal history", () => {
    let state = hire(); state.employees[0].leave = [{ id: "leave", startDay: 5, endDay: 5, days: 1 }];
    state = applyKqStaffCommand(raw(state, atDay(1)), renew(state.employees[0], 1), "renew").state;
    const before = structuredClone(state.employees[0]);
    const result = applyKqStaffCommand(raw(state, atDay(20)), convert(before), "convert");
    expect(result.state.employees[0]).toEqual({ ...before, contract: "cdi", reason: "permanent", endsAt: null, convertedToCdiAt: atDay(20) });
    expect(getKqStaffLeave(result.state.employees[0], atDay(20))).toEqual(getKqStaffLeave(before, atDay(20)));
    const later = advanceKqStaff(raw(result.state, atMonth(5))).state;
    expect(later.employees[0].status).toBe("active");
    expect(later.payroll.every(pay => pay.indemnityCents === 0)).toBe(true);
    expect(isKqStaffState(later)).toBe(true);
  });
  it("fails closed on malformed optional contract history", () => {
    const state = hire();
    state.employees[0].renewals = [{ at: atMonth(3), previousEndsAt: atMonth(3), endsAt: atMonth(6) }];
    expect(isKqStaffState(state)).toBe(false);
    expect(() => applyKqStaffCommand(raw(state), renew(state.employees[0], 1), "bad")).toThrow(/incompatible/);
  });
});

describe("role/post CDD waiting periods", () => {
  it.each([[0, 13, 23], [0, 14, 19], [.5, 14.5, 22], [0, 5, 10], [0, 30, 44]] as const)("counts opening days from exclusive end %s to %s", (hired, end, available) => {
    const employee = { ...hire().employees[0], hiredAt: atDay(hired), endsAt: atDay(end), status: "ended" as const };
    expect(getKqStaffContractCooldown(employee, atDay(0))).toBe(atDay(available));
  });
  it("does not invent a waiting period after seasonal work or a CDI", () => {
    expect(getKqStaffContractCooldown(hire("seasonal", 3).employees[0], atDay(0))).toBeNull();
    expect(getKqStaffContractCooldown(hire("cdi", 0).employees[0], atDay(0))).toBeNull();
  });
  it("blocks a different person in the same role, including seasonal hiring, but exempts CDI", () => {
    const snapshot = raw(); snapshot.context.contractCooldowns = { worker: atDay(3) };
    const command = { action: "hire" as const, candidateCode: "mael", contract: "cdd" as const, durationMonths: 3, weeklyHours: 35, reason: "temporary-increase" as const, expectedMonthlyCostCents: getKqStaffMonthlyCost(KQ_STAFF_CANDIDATES[1], 35).totalCents };
    expect(() => applyKqStaffCommand(snapshot, command, "another")).toThrow(/carence/);
    expect(() => applyKqStaffCommand(snapshot, { ...command, contract: "seasonal", reason: "harvest" }, "harvest")).toThrow(/carence/);
    expect(applyKqStaffCommand(snapshot, { ...command, contract: "cdi", reason: "permanent", durationMonths: 0 }, "permanent").state.employees).toHaveLength(1);
    expect(getKqStaffRoleContractBlock({ ...snapshot, serverNow: atDay(3) }, "worker", "cdd")).toBeNull();
    expect(getKqStaffRoleContractBlock(snapshot, "processor", "cdd")).toBeNull();
  });
  it("keeps old server hiring behavior until lifecycle capability is installed", () => {
    const snapshot = raw(); delete snapshot.context.contractLifecycleVersion; snapshot.context.contractCooldowns = { worker: atDay(3) };
    expect(getKqStaffRoleContractBlock(snapshot, "worker", "cdd")).toBeNull();
    expect(() => applyKqStaffCommand({ ...snapshot, state: hire() }, renew(hire().employees[0], 1), "unsupported")).toThrow(/mise à jour/);
  });
});

describe("rehiring a persisted person", () => {
  it("copies exact final skills and identity into a fresh contract without altering the archive", () => {
    const source = archivedSource(); const original = structuredClone(source);
    source.weeklyPlan = { enabled: true, days: [[], [], [], [], []], nextDay: 3, updatedAt: atDay(1), weeklyCostCents: 0, history: [] };
    const snapshot = raw(null, source.endsAt!); snapshot.context.rehireSource = source;
    const result = applyKqStaffCommand(snapshot, rehire(source), "contract-2");
    const employee = result.state.employees[0];
    expect(employee).toMatchObject({ id: "contract-2", personId: "contract-1", previousContractId: "contract-1", name: source.name,
      trait: source.trait, portraitCode: "anna", hourlyCents: source.hourlyCents, classification: source.classification,
      skills: source.skills, contracts: source.contracts, status: "active", contract: "cdi", reason: "permanent", endsAt: null,
      hiredAt: source.endsAt, paidUntil: source.endsAt, nextPayrollAt: iso(Date.parse(source.endsAt!) + KQ_GAME_MONTH_MS),
      renewals: [], leave: [], grossEarnedCents: 0, overtimeGrossCents: 0, finalPaid: false, completedTasks: 0 });
    expect(employee.weeklyPlan).toBeUndefined(); expect(employee.convertedToCdiAt).toBeUndefined();
    expect(result.state.payroll).toEqual([]); expect(result.state.tasks).toEqual([]); expect(result.debitCents).toBe(0);
    expect(source.skills).toEqual(original.skills); expect(employee.skills).not.toBe(source.skills);
    expect(employee.workDays).not.toBe(source.workDays); expect(employee.contracts).not.toBe(source.contracts);
  });
  it("retains the same person's daily allowance and recent overtime evidence", () => {
    const source = archivedSource();
    source.workDays["1"] = { usedHours: 7, extraHours: 3 }; // Outside the current twelve-week window.
    source.workDays["99"] = { usedHours: 7, extraHours: 2 };
    const snapshot = raw(null, source.endsAt!); snapshot.context.rehireSource = source;
    const employee = applyKqStaffCommand(snapshot, rehire(source), "new").state.employees[0];
    const calendar = getKqStaffCalendar(atDay(0), snapshot.serverNow);
    expect(employee.workDays["100"]).toEqual({ usedHours: 10, extraHours: 3 });
    expect(employee.workDays["99"]).toEqual({ usedHours: 7, extraHours: 2 });
    expect(employee.workDays["1"]).toBeUndefined();
    expect(getKqStaffCapacity(employee, calendar).remainingHours).toBe(0);
    expect(() => getKqStaffExtraQuote(employee, calendar, .5)).toThrow(/10 heures/);
  });
  it("does not clear the twelve-week overtime ceiling when a new contract begins", () => {
    const source = archivedSource(); source.workDays = {};
    const snapshot = raw(null, source.endsAt!); const calendar = getKqStaffCalendar(atDay(0), snapshot.serverNow);
    for (let week = calendar.week - 11; week < calendar.week; week++) for (let weekday = 2; weekday <= 4; weekday++) source.workDays[String(week * 7 + weekday + 1)] = { usedHours: 0, extraHours: 3 };
    for (const week of [calendar.week - 2, calendar.week - 1, calendar.week]) source.workDays[String(week * 7 + 1)] = { usedHours: 0, extraHours: 3 };
    snapshot.context.rehireSource = source;
    const employee = applyKqStaffCommand(snapshot, rehire(source), "new").state.employees[0];
    expect(() => getKqStaffExtraQuote(employee, calendar, 1)).toThrow(/44 h/);
  });
  it("uses a live final snapshot after completing work and keeps all previous contract evidence", () => {
    let state = hire();
    state = applyKqStaffCommand(raw(state), { action: "train", employeeId: "contract-1", skill: "processing", hours: 2, expectedCostCents: 7000 }, "training").state;
    state = finish(state);
    expect(state.employees[0].skills.processing).toBeGreaterThan(0);
    const old = structuredClone(state), snapshot = raw(state, state.employees[0].endsAt!);
    snapshot.context.rehireSource = { ...state.employees[0], skills: { ...candidate.skills } }; // Older hydrated evidence cannot replace live final XP.
    const result = applyKqStaffCommand(snapshot, rehire(state.employees[0]), "next");
    expect(result.state.employees[1].skills).toEqual(old.employees[0].skills);
    expect(result.state.employees[0]).toEqual(old.employees[0]); expect(result.state.payroll).toEqual(old.payroll); expect(result.state.tasks).toEqual(old.tasks);
  });
  it("rejects duplicate active people, superseded contracts and reused contract identifiers", () => {
    const source = archivedSource(), snapshot = raw(createKqStaffState(source.endsAt!), source.endsAt!); snapshot.context.rehireSource = source;
    const second = applyKqStaffCommand(snapshot, rehire(source), "second").state;
    expect(() => applyKqStaffCommand({ ...snapshot, state: second }, rehire(source), "duplicate")).toThrow(/déjà un contrat actif/);
    second.employees[0].status = "ended";
    expect(getKqStaffRehireBlock({ ...snapshot, state: second }, source, "cdi")).toMatch(/plus récent/);
    expect(() => applyKqStaffCommand(snapshot, rehire(source), source.id)).toThrow(/identifiant distinct/);
  });
  it("does not mistake generated final pay for settled pay or ignore running work", () => {
    const state = advanceKqStaff(raw(hire(), atMonth(3))).state, source = state.employees[0];
    expect(source.finalPaid).toBe(true);
    expect(() => applyKqStaffCommand(raw(state, atMonth(3)), rehire(source), "unpaid")).toThrow(/salaires échus/);
    const paid = finish(), snapshot = raw(paid, atMonth(3));
    paid.tasks.push({ id: "old-running", employeeId: "contract-1", status: "running", kind: "training", skill: "culture", hours: 2, day: 91, startedAt: atMonth(3), completesAt: atDay(92), trainingCostCents: 7000, skillLevel: 1 });
    expect(() => applyKqStaffCommand(snapshot, rehire(paid.employees[0]), "still-working")).toThrow(/tâches/);
  });
  it("rejects missing, mismatched or incomplete authoritative sources", () => {
    const source = archivedSource(), snapshot = raw(null, source.endsAt!);
    expect(() => applyKqStaffCommand(snapshot, rehire(source), "absent")).toThrow(/précédent/);
    snapshot.context.rehireSource = source;
    expect(() => applyKqStaffCommand(snapshot, { ...rehire(source), sourceContractId: "other" }, "mismatch")).toThrow(/précédent/);
    source.skills.processing = NaN;
    expect(() => applyKqStaffCommand(snapshot, rehire(source), "invalid")).toThrow(/incomplet/);
  });
  it("retains a person identity through later engagements and checks contract terms and capacity", () => {
    const source = archivedSource(); source.personId = "first-person"; source.previousContractId = "older-contract";
    const snapshot = raw(null, source.endsAt!); snapshot.context.rehireSource = source;
    expect(applyKqStaffCommand(snapshot, rehire(source), "latest").state.employees[0].personId).toBe("first-person");
    expect(() => applyKqStaffCommand(snapshot, { ...rehire(source), weeklyHours: 10 }, "bad-hours")).toThrow(/7, 14/);
    expect(() => applyKqStaffCommand(snapshot, { ...rehire(source), expectedMonthlyCostCents: 1 }, "bad-price")).toThrow(/coût/);
    expect(() => applyKqStaffCommand(snapshot, { ...rehire(source), reason: "harvest" }, "bad-reason")).toThrow(/motif/);
    snapshot.state = createKqStaffState(source.endsAt!);
    snapshot.state.employees = Array.from({ length: 8 }, (_, index) => ({ ...hire("cdi", 0).employees[0], id: `other-${index}`, personId: `other-${index}`,
      hiredAt: snapshot.serverNow, paidUntil: snapshot.serverNow, nextPayrollAt: iso(Date.parse(snapshot.serverNow) + KQ_GAME_MONTH_MS) }));
    expect(() => applyKqStaffCommand(snapshot, rehire(source), "ninth")).toThrow(/huit salariés/);
  });
  it("adds no experience during time away and charges only the new engagement's future salary", () => {
    const source = archivedSource(), now = iso(Date.parse(source.endsAt!) + 8 * KQ_GAME_MONTH_MS);
    const snapshot = raw(null, now); snapshot.context.rehireSource = source;
    const result = applyKqStaffCommand(snapshot, rehire(source), "after-absence");
    expect(result.state.employees[0].skills).toEqual(source.skills);
    expect(result.state.employees[0].workDays).toEqual({});
    expect(result.state.payroll).toEqual([]);
    const later = advanceKqStaff(raw(result.state, iso(Date.parse(now) + KQ_GAME_MONTH_MS))).state;
    expect(later.payroll).toHaveLength(1);
    expect(later.payroll[0]).toMatchObject({ employeeId: "after-absence", totalCents: monthlyCost, indemnityCents: 0 });
  });
});

describe("contract command trust boundaries", () => {
  it("accepts only the agreed command fields, never supplied skills, profiles, clocks or state", () => {
    const employee = hire().employees[0], source = archivedSource();
    for (const command of [renew(employee, 2), convert(employee), rehire(source)]) expect(parseKqStaffCommand({ ...command,
      skills: { processing: 8100 }, rehireSource: source, state: {}, personId: "forged", hiredAt: atDay(0), renewals: [] })).toEqual(command);
  });
  it.each([0, -1, .5, 1.5, 19, Infinity, NaN])("rejects an invalid renewal duration %s", months => {
    expect(() => parseKqStaffCommand({ ...renew(hire().employees[0], 1), months })).toThrow();
  });
  it("rejects a missing or invalid quoted end date", () => {
    for (const expectedEndsAt of [undefined, "not-a-date"]) expect(() => parseKqStaffCommand({ ...convert(hire().employees[0]), expectedEndsAt })).toThrow();
  });
});

describe("contract amendments after authoritative settlement", () => {
  it.each(["renew-contract", "convert-cdi"] as const)("%s preserves continuous trim until the next settlement", action => {
    const snapshot = trimFixture(raw(hire()), "contract-1");
    const hour = KQ_GAME_DAY_MS / 24;
    settleTrim(snapshot, iso(START + hour / 4));
    expect(snapshot.state!.tasks[0].trimGrams).toBe(15);
    const persisted = structuredClone(snapshot.state!);
    snapshot.serverNow = iso(START + hour / 2);
    const command = action === "renew-contract" ? renew(persisted.employees[0], 1) : convert(persisted.employees[0]);
    const amended = applyKqStaffCommand(snapshot, command, "amend");
    expect(amended.effects).toEqual([]); expect(amended.debitCents).toBe(0);
    expect(amended.state.tasks).toEqual(persisted.tasks);
    expect(amended.state.tasks[0].trimProgressAt).toBe(iso(START + hour / 4));
    expect(amended.state.lastSettledAt).toBe(snapshot.serverNow);
    expect(amended.state.employees[0].skills).toEqual(persisted.employees[0].skills);
    snapshot.state = amended.state;
    const finished = settleTrim(snapshot, iso(START + hour * 2));
    expect(finished.effects).toEqual([{ kind: "trim-work", unit: "g", flowerId: "trim-lot", mode: "manual", work: 105, qualityDelta: 1 }]);
    expect(snapshot.context.trimLots![0].completedGrams).toBe(120);
    expect(snapshot.state!.tasks[0]).toMatchObject({ status: "completed", trimGrams: 120 });
    expect(snapshot.state!.employees[0].skills.processing).toBe(30);
    expect(settleTrim(snapshot, snapshot.serverNow).effects).toEqual([]);
  });
  it("rehiring clones persisted XP while another person's running trim catches up exactly once", () => {
    const source = archivedSource(), began = Date.parse(source.endsAt!), hour = KQ_GAME_DAY_MS / 24;
    const snapshot = trimFixture(raw(null, source.endsAt!), null); snapshot.context.rehireSource = source;
    settleTrim(snapshot, iso(began + hour / 4));
    const persisted = structuredClone(snapshot.state!);
    snapshot.serverNow = iso(began + hour / 2);
    const rehired = applyKqStaffCommand(snapshot, rehire(source), "returning-worker");
    expect(rehired.effects).toEqual([]); expect(rehired.state.tasks).toEqual(persisted.tasks);
    expect(rehired.state.playerProcessingXp).toBe(persisted.playerProcessingXp);
    expect(rehired.state.employees[0].skills).toEqual(source.skills);
    snapshot.state = rehired.state;
    const finished = settleTrim(snapshot, iso(began + hour * 2));
    expect(finished.effects).toEqual([{ kind: "trim-work", unit: "g", flowerId: "trim-lot", mode: "manual", work: 105, qualityDelta: 1 }]);
    expect(snapshot.context.trimLots![0].completedGrams).toBe(120);
    expect(snapshot.state!.playerProcessingXp).toBe(24);
    expect(snapshot.state!.employees[0].skills).toEqual(source.skills);
    expect(settleTrim(snapshot, snapshot.serverNow).effects).toEqual([]);
  });
  it("still rejects malformed state and a backwards clock on the frozen lifecycle path", () => {
    const state = hire(); state.lastSettledAt = atDay(2);
    expect(() => applyKqStaffCommand(raw(state, atDay(1)), renew(state.employees[0], 1), "backwards")).toThrow(/Horloge/);
    state.employees[0].skills.processing = NaN;
    expect(() => applyKqStaffCommand(raw(state, atDay(3)), renew(state.employees[0], 1), "malformed")).toThrow(/incompatible/);
  });
});
