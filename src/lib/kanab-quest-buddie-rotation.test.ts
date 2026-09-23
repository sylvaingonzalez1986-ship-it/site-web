import { describe, expect, it } from "vitest";
import {
  getKqBuddieRotationRemaining,
  recordKqBuddieUse,
} from "./kanab-quest-buddie-rotation";

describe("Buddie rotation", () => {
  it("allows a first use and requires five other varieties before reuse", () => {
    expect(getKqBuddieRotationRemaining("favorite", [])).toBe(0);
    let recent = recordKqBuddieUse("favorite", []);
    expect(getKqBuddieRotationRemaining("favorite", recent)).toBe(5);
    for (let index = 1; index <= 5; index += 1) {
      const code = `other-${index}`;
      expect(getKqBuddieRotationRemaining(code, recent)).toBe(0);
      recent = recordKqBuddieUse(code, recent);
      expect(getKqBuddieRotationRemaining("favorite", recent)).toBe(5 - index);
    }
    recent = recordKqBuddieUse("favorite", recent);
    expect(getKqBuddieRotationRemaining("favorite", recent)).toBe(5);
    expect(getKqBuddieRotationRemaining("other-1", recent)).toBe(0);
  });

  it("counts distinct varieties even when historical uses contain duplicates", () => {
    expect(getKqBuddieRotationRemaining("favorite", ["B", "B", "B", "B", "favorite"])).toBe(4);
    expect(getKqBuddieRotationRemaining("favorite", ["E", "D", "C", "B", "B", "favorite"])).toBe(1);
    expect(getKqBuddieRotationRemaining("favorite", ["F", "E", "D", "C", "B", "favorite"])).toBe(0);
  });

  it("applies the same rotation to every used card and keeps six-card cycles playable", () => {
    let recent: string[] = [];
    const codes = ["A", "B", "C", "D", "E", "F"];
    for (let turn = 0; turn < 24; turn += 1) {
      const code = codes[turn % codes.length];
      expect(getKqBuddieRotationRemaining(code, recent)).toBe(0);
      recent = recordKqBuddieUse(code, recent);
      for (let index = 0; index < recent.length; index += 1) {
        expect(getKqBuddieRotationRemaining(recent[index], recent)).toBe(5 - index);
      }
    }
  });

  it("does not exempt a small collection from the rule", () => {
    const recent = ["E", "D", "C", "B", "A"];
    expect(recent.every((code) => getKqBuddieRotationRemaining(code, recent) > 0)).toBe(true);
    expect(getKqBuddieRotationRemaining("F", recent)).toBe(0);
  });

  it("records each code once without mutating its input", () => {
    const original = ["E", "D", "C", "B", "A"];
    expect(recordKqBuddieUse("B", original)).toEqual(["B", "E", "D", "C", "A"]);
    expect(original).toEqual(["E", "D", "C", "B", "A"]);
  });
});
