import { describe, expect, it } from "vitest";
import { KQ_GAME_DAY_MS } from "./kanab-quest-business";
import {
  getKqStaffTrimQuote, KQ_STAFF_PLAYER_DAILY_HOURS, KQ_STAFF_TRIM_REQUIRED_WORK,
  KQ_STAFF_TRIMMER_COST_CENTS, type KqStaffTrimLot, type KqStaffTrimMode,
} from "./kanab-quest-staff-trim";

function lot(overrides: Partial<KqStaffTrimLot> = {}): KqStaffTrimLot {
  return { flowerId: "flower-1", name: "Récolte à préparer", requiredWork: 6, completedWork: 0, mode: null, completedAt: null, ...overrides };
}

describe("trim work quotes", () => {
  it("uses explicit fictional lot work units and a shared purchase price in cents", () => {
    expect(KQ_STAFF_TRIM_REQUIRED_WORK).toBe(6);
    expect(KQ_STAFF_TRIMMER_COST_CENTS).toBe(150_000);
    expect(KQ_STAFF_PLAYER_DAILY_HOURS).toBe(12);
    const manual = getKqStaffTrimQuote({ lot: lot(), mode: "manual", hours: 6, level: 1 });
    const machine = getKqStaffTrimQuote({ lot: lot(), mode: "machine", hours: 1.5, level: 1 });
    expect(manual.work).toBe(6);
    expect(machine.work).toBe(6);
    expect(manual.durationMs).toBe(KQ_GAME_DAY_MS / 4);
    expect(machine.durationMs).toBe(manual.durationMs / 4);
    expect(manual.qualityDelta).toBe(1);
    expect(machine.qualityDelta).toBe(-3);
  });

  it("makes processing experience improve throughput without claiming extra work hours", () => {
    const largeLot = lot({ requiredWork: 100 });
    const beginner = getKqStaffTrimQuote({ lot: largeLot, mode: "manual", hours: 2, level: 1 });
    const experienced = getKqStaffTrimQuote({ lot: largeLot, mode: "manual", hours: 2, level: 10 });
    const machine = getKqStaffTrimQuote({ lot: largeLot, mode: "machine", hours: 2, level: 10 });
    expect(beginner.work).toBe(2);
    expect(experienced.work).toBeCloseTo(3.44);
    expect(machine.work).toBeCloseTo(experienced.work * 4);
    expect(experienced.durationMs).toBe(beginner.durationMs);
    expect(machine.durationMs).toBe(beginner.durationMs);
  });

  it("caps work by the lot's remaining preparation while retaining the quoted reserved time", () => {
    const remaining = lot({ completedWork: 5.8, mode: "machine" });
    const quote = getKqStaffTrimQuote({ lot: remaining, mode: "machine", hours: 7, level: 10 });
    expect(quote.work).toBe(0.2);
    expect(remaining.completedWork + quote.work).toBe(6);
    expect(quote.durationMs).toBe(7 * KQ_GAME_DAY_MS / 24);
  });

  it("keeps the final fractional work acceptable to SQL and applies advertised speed traits", () => {
    expect(JSON.stringify(getKqStaffTrimQuote({ lot: lot({ completedWork: 5.94 }), mode: "manual", hours: 0.5, level: 1 }).work)).toBe("0.06");
    const regular = getKqStaffTrimQuote({ lot: lot(), mode: "manual", hours: 2, level: 1 });
    const quick = getKqStaffTrimQuote({ lot: lot(), mode: "manual", hours: 2, level: 1, trait: "quick" });
    const careful = getKqStaffTrimQuote({ lot: lot(), mode: "manual", hours: 2, level: 1, trait: "meticulous" });
    expect(quick.durationMs).toBeLessThan(regular.durationMs);
    expect(careful.durationMs).toBeGreaterThan(regular.durationMs);
    expect(quick.work).toBe(regular.work);
    expect(careful.qualityDelta).toBeGreaterThan(regular.qualityDelta);
  });

  it("keeps the input untouched so a preview cannot progress the lot", () => {
    const untouched = Object.freeze(lot({ completedWork: 1.5, mode: "manual" }));
    const first = getKqStaffTrimQuote({ lot: untouched, mode: "manual", hours: 2, level: 5 });
    const second = getKqStaffTrimQuote({ lot: untouched, mode: "manual", hours: 2, level: 5 });
    expect(second).toEqual(first);
    expect(untouched.completedWork).toBe(1.5);
    expect(untouched.completedAt).toBeNull();
  });

  it.each(["manual", "machine"] as const)("conserves required work across several %s sessions", mode => {
    const current = lot();
    let completed = 0;
    while (current.completedWork < current.requiredWork) {
      const quote = getKqStaffTrimQuote({ lot: current, mode, hours: 0.5, level: 3 });
      expect(quote.work).toBeGreaterThan(0);
      completed += quote.work;
      current.completedWork += quote.work;
      current.mode = mode;
    }
    expect(completed).toBeCloseTo(6);
    expect(current.completedWork).toBe(6);
    expect(() => getKqStaffTrimQuote({ lot: current, mode, hours: 0.5, level: 3 })).toThrow();
  });

  it("returns one final quality adjustment independent of how many hours a session reserves", () => {
    for (let level = 1; level <= 10; level++) {
      const manual = getKqStaffTrimQuote({ lot: lot(), mode: "manual", hours: 0.5, level });
      const machine = getKqStaffTrimQuote({ lot: lot(), mode: "machine", hours: 0.5, level });
      expect(Number.isInteger(manual.qualityDelta)).toBe(true);
      expect(manual.qualityDelta).toBeGreaterThanOrEqual(1);
      expect(manual.qualityDelta).toBeLessThanOrEqual(3);
      expect(Number.isInteger(machine.qualityDelta)).toBe(true);
      expect(machine.qualityDelta).toBeGreaterThanOrEqual(-3);
      expect(machine.qualityDelta).toBeLessThanOrEqual(-1);
      expect(getKqStaffTrimQuote({ lot: lot(), mode: "manual", hours: 7, level }).qualityDelta).toBe(manual.qualityDelta);
    }
    expect(getKqStaffTrimQuote({ lot: lot(), mode: "manual", hours: 2, level: 1, trait: "meticulous" }).qualityDelta).toBe(2);
    expect(getKqStaffTrimQuote({ lot: lot(), mode: "manual", hours: 2, level: 10, trait: "meticulous" }).qualityDelta).toBe(3);
  });

  it("refuses to change a partially trimmed lot's preparation method", () => {
    expect(() => getKqStaffTrimQuote({ lot: lot({ mode: "manual", completedWork: 1 }), mode: "machine", hours: 1, level: 5 })).toThrow();
    expect(() => getKqStaffTrimQuote({ lot: lot({ mode: "machine", completedWork: 1 }), mode: "manual", hours: 1, level: 5 })).toThrow();
  });

  it.each([0, -1, 0.25, 12.5, NaN, Infinity])("rejects an invalid duration %s", hours => {
    expect(() => getKqStaffTrimQuote({ lot: lot(), mode: "manual", hours, level: 1 })).toThrow();
  });

  it.each([0, 11, 1.5, NaN, Infinity])("rejects an invalid skill level %s", level => {
    expect(() => getKqStaffTrimQuote({ lot: lot(), mode: "manual", hours: 1, level })).toThrow();
  });

  it.each([
    { requiredWork: 0 }, { requiredWork: -1 }, { requiredWork: Infinity },
    { completedWork: -1 }, { completedWork: 6 }, { completedWork: 7 }, { completedWork: NaN },
    { completedAt: "2026-11-07T12:00:00Z" },
  ])("refuses completed or malformed lot state %j", overrides => {
    expect(() => getKqStaffTrimQuote({ lot: lot(overrides), mode: "manual", hours: 1, level: 1 })).toThrow();
  });

  it.each(["__proto__", "constructor", "fast"])("rejects unknown mode %s", mode => {
    expect(() => getKqStaffTrimQuote({ lot: lot(), mode: mode as KqStaffTrimMode, hours: 1, level: 1 })).toThrow();
  });
});
