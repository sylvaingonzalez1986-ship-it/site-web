import { describe, expect, it } from "vitest";
import { isKqProcessingJob, isKqProcessingPlan, isKqProcessingWorkQuote, type KqProcessingJob, type KqProcessingWorkQuote } from "./kanab-quest-processing-work";
import { createKqProcessingPlan } from "./kanab-quest-processing-profiles";

function fixture(): KqProcessingWorkQuote {
  return {
    version: 1, flowerId: "11111111-1111-4111-8111-111111111111", token: "a".repeat(32),
    inputGrams: 1200, source: "player", employee: null, efficiency: .8, playerRemainingHours: 12,
    bookedHours: 2, activeHours: 2, nominalHours: 1.6, remainingNominalHours: 5, fundedGrams: 384,
    passiveHours: 0, startedAt: "2026-11-08T12:00:00.000Z", readyAt: "2026-11-08T12:20:00.000Z", blockedReason: null,
  };
}
const employee: NonNullable<KqProcessingWorkQuote["employee"]> = {
  id: "worker-1", name: "Anna", code: "worker-anna", role: "processor", taskId: "task-1",
  level: 4, allocatedHours: 7, usedHours: 1, remainingHours: 6,
};

describe("processing work quotes at the server boundary", () => {
  it("validates the optional actor choices without accepting another person's quote", () => {
    const choices = { actorChoiceVersion: 1, actorId: "player", actors: [
      { id: "player", name: "Toi", employee: null, remainingHours: 12, available: true, reason: null },
      { id: employee.id, name: employee.name, employee, remainingHours: 6, available: true, reason: null },
    ] };
    expect(isKqProcessingWorkQuote({ ...fixture(), ...choices })).toBe(true);
    expect(isKqProcessingWorkQuote({ ...fixture(), ...choices, actorId: employee.id })).toBe(false);
    expect(isKqProcessingWorkQuote({ ...fixture(), ...choices, actors: [...choices.actors, choices.actors[0]] })).toBe(false);
    expect(isKqProcessingWorkQuote({ ...fixture(), ...choices, actors: [{ ...choices.actors[0], remainingHours: 13 }] })).toBe(false);
    expect(isKqProcessingWorkQuote({ ...fixture(), actorId: "player" })).toBe(false);
    expect(isKqProcessingWorkQuote({ ...fixture(), ...choices, actors: [{ ...choices.actors[1], employee: null }] })).toBe(false);
  });
  it("accepts a funded tranche whose remaining total work exceeds this tranche", () => {
    const quote = fixture();
    expect(quote.remainingNominalHours).toBeGreaterThan(quote.nominalHours);
    expect(isKqProcessingWorkQuote(quote)).toBe(true);
    expect(isKqProcessingWorkQuote({ ...quote, source: "employee", employee })).toBe(true);
  });

  it.each([null, employee])("accepts a blocked quote with no work booked and an optional delegated actor", actor => {
    expect(isKqProcessingWorkQuote({ ...fixture(), source: "blocked", employee: actor, bookedHours: 0, activeHours: 0,
      nominalHours: 0, fundedGrams: 0, startedAt: null, readyAt: null, blockedReason: "Heures épuisées." })).toBe(true);
  });

  it.each([.5, .55, 1])("accepts a bounded SQL efficiency of %s without multiplying the manufacturer's ceiling", efficiency => {
    expect(isKqProcessingWorkQuote({ ...fixture(), efficiency, nominalHours: efficiency * 2 })).toBe(true);
  });

  it.each([
    ["unknown version", { version: 2 }], ["empty flower", { flowerId: "" }],
    ["short token", { token: "a".repeat(31) }], ["long token", { token: "a".repeat(33) }],
    ["uppercase token", { token: "A".repeat(32) }], ["invalid token", { token: "g".repeat(32) }],
    ["unknown source", { source: "automatic" }], ["missing employee", { source: "employee" }],
    ["player with employee", { employee }], ["zero input", { inputGrams: 0 }],
    ["zero efficiency", { efficiency: 0 }], ["negative efficiency", { efficiency: -1 }],
    ["excess efficiency", { efficiency: 1.01 }], ["NaN efficiency", { efficiency: NaN }],
    ["extra player budget", { playerRemainingHours: 12.5 }], ["extra booking", { bookedHours: 12.5 }],
    ["fractional booking", { bookedHours: 1.25 }], ["active exceeds booking", { activeHours: 2.5 }],
    ["funded exceeds input", { fundedGrams: 1201 }], ["negative remainder", { remainingNominalHours: -.1 }],
    ["tranche exceeds total remaining work", { nominalHours: 6 }],
    ["infinite duration", { passiveHours: Infinity }], ["invalid beginning", { startedAt: "invalid" }],
    ["invalid ending", { readyAt: "invalid" }], ["invalid reason", { blockedReason: 1 }],
  ])("rejects %s", (_label, changes) => {
    expect(isKqProcessingWorkQuote({ ...fixture(), ...changes })).toBe(false);
  });

  it.each([
    ["missing id", { id: "" }], ["missing task", { taskId: "" }], ["unknown role", { role: "owner" }],
    ["zero level", { level: 0 }], ["excess level", { level: 11 }], ["fractional level", { level: 1.5 }],
    ["invalid allocation", { allocatedHours: 10.5 }], ["fractional use", { usedHours: .25 }],
    ["unbalanced hours", { remainingHours: 7 }], ["negative remainder", { remainingHours: -.5 }],
  ])("rejects employee %s", (_label, changes) => {
    expect(isKqProcessingWorkQuote({ ...fixture(), source: "employee", employee: { ...employee, ...changes } })).toBe(false);
  });

  it.each([null, undefined, [], "quote", 1])("rejects non-object payload %s", value => {
    expect(isKqProcessingWorkQuote(value)).toBe(false);
  });
});

describe("processing plan and persisted job guards", () => {
  function plan() { return createKqProcessingPlan({ inputGrams: 1200, productGrams: 120, equipmentCodes: ["SIFT-TRAY", "FREEZE-DRYER"] })!; }
  function job(): KqProcessingJob {
    const work = plan();
    return { version: 1, flowerId: fixture().flowerId, route: "dry-sift", inputGrams: 1200, completedGrams: 0,
      fundedGrams: 600, remainingGrams: 1200, nominalHours: work.nominalHours, remainingNominalHours: work.nominalHours,
      status: "running", startedAt: fixture().startedAt, readyAt: fixture().readyAt, finalReadyAt: null,
      delegated: false, actor: null, bookedHours: 2, activeHours: 2, remainingHours: 0, plan: work };
  }

  it("accepts the actual generated serial plan including the passive dryer", () => {
    expect(isKqProcessingPlan(plan())).toBe(true);
    expect(isKqProcessingJob(job())).toBe(true);
  });

  it.each([
    ["version", { version: 2 }], ["profile version", { profileVersion: 99 }], ["missing mass", { inputGrams: 0 }],
    ["missing work", { nominalHours: 0 }], ["negative passive time", { passiveHours: -1 }],
    ["missing machines", { machines: [] }], ["null stage", { machines: [null] }],
    ["invalid sources", { sources: [{ label: "fake", url: "javascript:alert(1)" }] }],
  ])("rejects invalid plan %s", (_label, changes) => {
    expect(isKqProcessingPlan({ ...plan(), ...changes })).toBe(false);
  });

  it.each([
    ["unknown basis", { basis: "wet-to-dry" }], ["unknown duration", { hours: NaN }],
    ["zero active rate", { gramsPerHour: 0 }], ["unavailable active rate", { gramsPerHour: null }],
    ["invalid URL", { sourceUrl: "file:///fake" }],
  ])("rejects invalid stage %s", (_label, changes) => {
    const work = plan();
    expect(isKqProcessingPlan({ ...work, machines: [{ ...work.machines[0], ...changes }] })).toBe(false);
  });

  it.each([
    ["empty payload", null], ["unknown status", { status: "invented" }], ["invalid flower", { flowerId: "flower" }],
    ["mass beyond funding", { completedGrams: 601 }], ["funding beyond input", { fundedGrams: 1201 }],
    ["work beyond total", { remainingNominalHours: 100 }], ["fractional budget", { bookedHours: 2.25 }],
    ["active beyond budget", { activeHours: 2.1 }], ["invalid final date", { finalReadyAt: "never" }],
    ["invalid actor", { actor: { ...employee, level: 11 } }], ["missing plan", { plan: null }],
  ])("rejects malformed persisted job %s", (_label, changes) => {
    expect(isKqProcessingJob(changes === null ? null : { ...job(), ...changes })).toBe(false);
  });
});
