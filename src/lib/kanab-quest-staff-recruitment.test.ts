import { describe, expect, it } from "vitest";
import { KQ_GAME_DAY_MS } from "./kanab-quest-business";
import { applyKqStaffCommand, getKqStaffMonthlyCost, getKqStaffRecruitment, KQ_STAFF_CANDIDATES, projectKqStaffSnapshot, type KqStaffCandidate, type KqStaffRawSnapshot, type KqStaffState } from "./kanab-quest-staff";

const START = "2026-10-24T22:00:00.000Z";
const dayAt = (day: number) => new Date(Date.parse(START) + (day - 1) * KQ_GAME_DAY_MS).toISOString();
const raw = (serverNow: string, state: KqStaffState | null = null): KqStaffRawSnapshot => ({
  state, revision: 0, serverNow, cashCents: 1_000_000,
  context: { businessStartedAt: START, reputation: 0, instagramFollowers: 0, shopPartners: 0, activeRuns: [], processingBatches: [], supplierInvoices: [] },
});
const hire = (candidate: KqStaffCandidate) => ({
  action: "hire" as const, candidateCode: candidate.code, contract: "cdi" as const, weeklyHours: 35,
  durationMonths: 0, reason: "permanent" as const, expectedMonthlyCostCents: getKqStaffMonthlyCost(candidate, 35).totalCents,
});

describe("staff recruitment periods", () => {
  it("keeps the first offers through day 15 and replaces them exactly at day 16", () => {
    const start = getKqStaffRecruitment(START, START);
    const lastMillisecond = getKqStaffRecruitment(START, new Date(Date.parse(dayAt(16)) - 1).toISOString());
    expect(start).toEqual(lastMillisecond);
    expect(start.candidates).toEqual(KQ_STAFF_CANDIDATES);
    expect(start.recruitment).toEqual({ cycle: 0, startDay: 1, nextDay: 16, refreshAt: dayAt(16) });
    const next = getKqStaffRecruitment(START, dayAt(16));
    expect(next.recruitment).toEqual({ cycle: 1, startDay: 16, nextDay: 31, refreshAt: dayAt(31) });
    expect(next.candidates.every(candidate => !start.candidates.some(old => old.code === candidate.code || old.name === candidate.name))).toBe(true);
    expect(getKqStaffRecruitment(START, dayAt(30))).toEqual(next);
  });

  it("uses the farm's elapsed game days across a timezone change and long absence", () => {
    const period = getKqStaffRecruitment(START, dayAt(151));
    expect(period.recruitment).toEqual({ cycle: 10, startDay: 151, nextDay: 166, refreshAt: dayAt(166) });
    expect(getKqStaffRecruitment("2026-10-25T00:00:00+02:00", dayAt(151))).toEqual(period);
    expect(getKqStaffRecruitment(dayAt(16), dayAt(16)).recruitment.cycle).toBe(0);
    expect(getKqStaffRecruitment(START, dayAt(31)).recruitment.cycle).toBe(2);
  });

  it("provides stable varied profiles, all five roles and valid portrait/salary references", () => {
    for (let cycle = 1; cycle <= 12; cycle++) {
      const { candidates } = getKqStaffRecruitment(START, dayAt(cycle * 15 + 1));
      expect(candidates).toHaveLength(11);
      expect(new Set(candidates.map(candidate => candidate.code)).size).toBe(11);
      expect(new Set(candidates.map(candidate => candidate.name)).size).toBe(11);
      expect(new Set(candidates.map(candidate => candidate.role)).size).toBe(5);
      expect(candidates).toEqual(getKqStaffRecruitment(START, dayAt(cycle * 15 + 8)).candidates);
      for (const candidate of candidates) {
        const template = KQ_STAFF_CANDIDATES.find(item => item.code === candidate.portraitCode)!;
        expect(template).toBeDefined();
        expect(candidate.hourlyCents).toBeGreaterThanOrEqual(template.hourlyCents);
        expect(candidate.contracts).toEqual(template.contracts);
        expect(Object.values(candidate.skills).every(value => value >= 0 && value <= 8100)).toBe(true);
      }
      const previous = getKqStaffRecruitment(START, dayAt((cycle - 1) * 15 + 1)).candidates;
      expect(candidates.every(candidate => !previous.some(old => old.name === candidate.name))).toBe(true);
    }
  });

  it("does not let a caller alter the shared catalogue or future projections", () => {
    const result = getKqStaffRecruitment(START, START);
    result.candidates[0].skills.culture = 9999;
    result.candidates[0].contracts.pop();
    expect(getKqStaffRecruitment(START, START).candidates).toEqual(KQ_STAFF_CANDIDATES);
    expect(KQ_STAFF_CANDIDATES[0].skills.culture).toBe(0);
  });

  it("rejects expired and future offers before applying any hire", () => {
    const initial = raw(dayAt(16));
    expect(() => applyKqStaffCommand(initial, hire(KQ_STAFF_CANDIDATES[0]), "expired")).toThrow(/15 jours de jeu/);
    const future = getKqStaffRecruitment(START, dayAt(31)).candidates[0];
    expect(() => applyKqStaffCommand(initial, hire(future), "future")).toThrow(/plus disponible/);
    expect(initial.state).toBeNull();
  });

  it("hires exactly the current profile and preserves existing employees across rotation", () => {
    const original = applyKqStaffCommand(raw(START), hire(KQ_STAFF_CANDIDATES[0]), "existing").state;
    const saved = structuredClone(original.employees[0]);
    const current = projectKqStaffSnapshot(raw(dayAt(16), original));
    expect(current.state.employees[0]).toEqual(saved);
    const candidate = current.candidates[0];
    const result = applyKqStaffCommand(raw(dayAt(16), original), hire(candidate), "new");
    expect(result.state.employees[0]).toEqual(saved);
    expect(result.state.employees[1]).toMatchObject({ ...candidate, id: "new", hiredAt: dayAt(16), status: "active" });
    expect(projectKqStaffSnapshot(raw(dayAt(16), result.state)).candidates.some(item => item.code === candidate.code)).toBe(false);
    expect(projectKqStaffSnapshot(raw(dayAt(31), result.state)).state.employees).toEqual(result.state.employees);
    expect(original.employees).toHaveLength(1);
  });

  it("requires the displayed current salary even when the candidate code is valid", () => {
    const candidate = getKqStaffRecruitment(START, dayAt(16)).candidates[0];
    expect(() => applyKqStaffCommand(raw(dayAt(16)), { ...hire(candidate), expectedMonthlyCostCents: 1 }, "wrong-cost")).toThrow(/coût du contrat/);
  });

  it("rejects an unavailable server calendar instead of inventing a recruitment period", () => {
    expect(() => getKqStaffRecruitment("invalid", START)).toThrow(/Calendrier/);
    expect(() => getKqStaffRecruitment(START, "invalid")).toThrow(/Calendrier/);
  });
});
