import { describe, expect, it } from "vitest";
import { getKqCommunicationActionLevel, getKqPlayerActionHours, getKqPlayerActionSkill, KQ_PLAYER_ACTION_COSTS } from "./kanab-quest-player-action-costs";
import type { KqStaffSkills } from "./kanab-quest-staff-types";

const communicationActions = [["commerce", "advertise"], ["online", "start-marketing"], ["social", "sponsor-post"]] as const;

describe("communication work time", () => {
  it.each(communicationActions)("charges %s/%s from one hour down to six minutes", (domain, action) => {
    expect(getKqPlayerActionHours(domain, action)).toBe(1);
    for (let level = 1; level <= 10; level++) {
      expect(getKqPlayerActionHours(domain, action, { communication: (level - 1) ** 2 * 100 })).toBe((11 - level) / 10);
    }
    expect(getKqPlayerActionHours(domain, action, { communication: 1_000_000 })).toBe(0.1);
  });

  it("changes cadence only when the existing Communication level advances", () => {
    expect(getKqCommunicationActionLevel(99)).toBe(1);
    expect(getKqCommunicationActionLevel(100)).toBe(2);
    expect(getKqPlayerActionHours("online", "start-marketing", { communication: 1599 })).toBe(0.7);
    expect(getKqPlayerActionHours("online", "start-marketing", { communication: 1600 })).toBe(0.6);
    expect(getKqPlayerActionHours("online", "start-marketing", { communication: 8100 })).toBe(0.1);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("does not invent speed for invalid XP %s", xp => {
    expect(getKqPlayerActionHours("social", "sponsor-post", { communication: xp })).toBe(1);
  });

  it("makes every eligible gesture ten times faster using only its relevant skill", () => {
    const expert: KqStaffSkills = { culture: 8100, processing: 8100, sales: 8100, communication: 8100, administration: 8100 };
    for (const [domain, actions] of Object.entries(KQ_PLAYER_ACTION_COSTS)) {
      for (const [action, base] of Object.entries(actions)) {
        const typedDomain = domain as keyof typeof KQ_PLAYER_ACTION_COSTS;
        expect(getKqPlayerActionHours(typedDomain, action, expert)).toBe(domain === "culture" ? base : base / 10);
        const skill = getKqPlayerActionSkill(typedDomain, action);
        if (skill) {
          expect(getKqPlayerActionHours(typedDomain, action, { [skill]: 8100 })).toBe(base / 10);
          expect(getKqPlayerActionHours(typedDomain, action, { ...expert, [skill]: 0 })).toBe(base);
          for (let level = 1; level <= 10; level++) {
            expect(getKqPlayerActionHours(typedDomain, action, { [skill]: (level - 1) ** 2 * 100 })).toBe(Math.round(base * (11 - level) * 10) / 100);
          }
        }
      }
    }
  });

  it("keeps half-hour gestures proportional, without a six-minute global floor", () => {
    expect(getKqPlayerActionHours("commerce", "sell", { sales: 100 })).toBe(0.45);
    expect(getKqPlayerActionHours("commerce", "sell", { sales: 1600 })).toBe(0.3);
    expect(getKqPlayerActionHours("commerce", "sell", { sales: 8100 })).toBe(0.05);
    expect(getKqPlayerActionHours("storage", "place", { processing: 8100 })).toBe(0.05);
    expect(getKqPlayerActionHours("administration", "pay-energy", { administration: 8100 })).toBe(0.05);
  });

  it("preserves culture rules and leaves unrecognized or free actions free", () => {
    expect(getKqPlayerActionHours("culture", "roll", { culture: 8100 })).toBe(0.5);
    expect(getKqPlayerActionHours("culture", "resolve", { culture: 8100 })).toBe(0);
    for (const action of ["advertise", "toString", "__proto__", "sponsor-claim"]) {
      expect(getKqPlayerActionHours("social", action, { communication: 8100 })).toBe(0);
      expect(getKqPlayerActionSkill("social", action)).toBeNull();
    }
  });
});
