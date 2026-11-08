import { describe, expect, it } from "vitest";
import { isKqCultureWorkChoice, isKqCultureWorkQuote, type KqCultureWorkQuote } from "./kanab-quest-culture-work";

const quote = (): KqCultureWorkQuote => ({
  version: 1, runId: "22222222-2222-4222-8222-222222222222", stageIndex: 0, day: 1,
  phase: "prepare", source: "employee", paid: false, stepHours: 0.5, playerRemainingHours: 12,
  employee: { id: "employee", name: "Anna", code: "anna", portraitCode: "anna", level: 3, role: "worker", taskId: "shift", allocatedHours: 3, usedHours: 1.5, remainingHours: 1.5 },
  bonus: { vitality: 1, terpenes: 0, yieldPercent: 0, cannabinoids: 0 },
});

describe("authoritative culture work quote validation", () => {
  it("accepts selectable actors without confusing their identity or reservations", () => {
    const offered = quote();
    const choices = [
      { choice: "player", source: "player", employee: null, available: true, bonus: offered.bonus },
      { choice: "employee:employee", source: "employee", employee: offered.employee, available: true, bonus: offered.bonus },
    ];
    expect(isKqCultureWorkQuote({ ...offered, workChoice: "auto", choices })).toBe(true);
    expect(isKqCultureWorkQuote({ ...offered, choices })).toBe(false);
    expect(isKqCultureWorkQuote({ ...offered, workChoice: "auto", choices: [...choices, choices[0]] })).toBe(false);
    expect(isKqCultureWorkQuote({ ...offered, workChoice: "auto", choices: [{ ...choices[1], choice: "employee:someone-else" }] })).toBe(false);
    expect(isKqCultureWorkQuote({ ...offered, workChoice: "player", choices: [{ ...choices[0], employee: offered.employee }] })).toBe(false);
    expect(isKqCultureWorkQuote({ ...offered, workChoice: "auto", choices: [{ ...choices[1], available: "yes" }] })).toBe(false);
  });

  it.each([null, {}, "", "employee:", "employee:../other", "employee:foreign:id", "player:other", "employee:" + "x".repeat(129)])("rejects invalid actor selection %s", value => {
    expect(isKqCultureWorkChoice(value)).toBe(false);
  });

  it("accepts a half-hour employee quote and a paid receipt without changing either", () => {
    const offered = quote();
    const before = structuredClone(offered);
    expect(isKqCultureWorkQuote(offered)).toBe(true);
    expect(offered).toEqual(before);
    expect(isKqCultureWorkQuote({ ...offered, phase: "rolled", paid: true })).toBe(true);
  });

  it.each(["player", "blocked"] as const)("accepts a %s quote without fabricating an employee", source => {
    expect(isKqCultureWorkQuote({ ...quote(), source, employee: null, reason: source === "blocked" ? "culture_work_exhausted" : null })).toBe(true);
  });

  it.each([11.95, 11.55, 8.2, 1.1, 0.55, 0.5, 0.49, 0.29, 0.25, 0.05, 0])("accepts a measured personal balance of %s h after skilled gestures without rounding it", playerRemainingHours => {
    const offered = { ...quote(), playerRemainingHours };
    const before = structuredClone(offered);
    expect(isKqCultureWorkQuote(offered)).toBe(true);
    expect(offered).toEqual(before);
    expect(isKqCultureWorkQuote({ ...offered, employee: null, source: playerRemainingHours < .5 ? "blocked" : "player" })).toBe(true);
    expect(isKqCultureWorkQuote({ ...offered, phase: "rolled", paid: true })).toBe(true);
  });

  it.each([
    ["missing employee", { employee: null }], ["missing bonus", { bonus: undefined }],
    ["wrong stage type", { stageIndex: "0" }], ["fractional stage", { stageIndex: 0.5 }],
    ["stage out of range", { stageIndex: 6 }], ["day zero", { day: 0 }],
    ["unknown phase", { phase: "pending" }], ["unknown source", { source: "auto" }],
    ["array phase", { phase: ["prepare"] }], ["array source", { source: ["player"], employee: null }],
    ["nonboolean receipt", { paid: 1 }], ["incorrect stage price", { stepHours: 1 }],
    ["negative player budget", { playerRemainingHours: -0.5 }], ["excess player budget", { playerRemainingHours: 12.5 }],
    ["unsupported player precision", { playerRemainingHours: 0.255 }], ["nonfinite budget", { playerRemainingHours: Infinity }],
    ["NaN budget", { playerRemainingHours: NaN }], ["string player budget", { playerRemainingHours: "11.55" }],
    ["missing player budget", { playerRemainingHours: undefined }], ["wrong reason type", { reason: {} }],
    ["negative bonus", { bonus: { vitality: -1, terpenes: 0, yieldPercent: 0, cannabinoids: 0 } }],
  ])("rejects %s", (_label, changes) => {
    expect(isKqCultureWorkQuote({ ...quote(), ...changes })).toBe(false);
  });

  it.each([
    ["unknown role", { role: "manager" }], ["array role", { role: ["worker"] }], ["empty task", { taskId: "" }], ["invalid level", { level: 11 }],
    ["fractional usage", { usedHours: 1.25 }], ["overused budget", { usedHours: 3.5, remainingHours: 0 }],
    ["inconsistent balance", { usedHours: 1, remainingHours: 1 }], ["negative remainder", { remainingHours: -0.5 }],
    ["string allocation", { allocatedHours: "3" }], ["zero allocation", { allocatedHours: 0 }],
  ])("rejects employee %s", (_label, changes) => {
    const offered = quote();
    expect(isKqCultureWorkQuote({ ...offered, employee: { ...offered.employee!, ...changes } })).toBe(false);
  });
});
