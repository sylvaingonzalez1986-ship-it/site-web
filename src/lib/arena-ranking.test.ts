import { describe, expect, it } from "vitest";
import { calculateArenaScore } from "@/lib/arena-ranking";

describe("calculateArenaScore", () => {
  it("admits tasting-only and business-only players", () => {
    expect(calculateArenaScore({ tastedFlowerCount: 5, duelSeasonPoints: 0 }))
      .toEqual({ total: 500, notebook: 500, placard: 0, business: 0, eligible: true });
    expect(calculateArenaScore({ tastedFlowerCount: 0, duelSeasonPoints: 0, businessScore: 90 }))
      .toEqual({ total: 90, notebook: 0, placard: 0, business: 90, eligible: true });
  });

  it("matches the reference profile and keeps the displayed sum exact", () => {
    expect(calculateArenaScore({ tastedFlowerCount: 5, duelSeasonPoints: 250, businessScore: 90 }))
      .toEqual({ total: 848.5, notebook: 500, placard: 258.5, business: 90, eligible: true });
  });

  it("has no global or discipline ceiling and diminishing duel returns", () => {
    const score = (points: number) => calculateArenaScore({ tastedFlowerCount: 100, duelSeasonPoints: points, businessScore: 426.5 });
    expect(score(6400)).toEqual({ total: 11127.6, notebook: 10000, placard: 701.1, business: 426.5, eligible: true });
    expect(score(400).placard - score(200).placard).toBeLessThan(score(200).placard - score(0).placard);
    expect(score(12800).placard).toBeGreaterThan(score(6400).placard);
  });

  it("counts whole discoveries and sanitizes invalid or negative inputs", () => {
    expect(calculateArenaScore({ tastedFlowerCount: 2.9, duelSeasonPoints: 0 }).notebook).toBe(200);
    for (const invalid of [-10, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(calculateArenaScore({ tastedFlowerCount: invalid, duelSeasonPoints: invalid, businessScore: invalid }))
        .toEqual({ total: 0, notebook: 0, placard: 0, business: 0, eligible: false });
    }
  });
});
