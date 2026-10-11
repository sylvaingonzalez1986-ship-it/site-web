import { describe, expect, it } from "vitest";
import { canReuseKqBootstrapProgress } from "./kanab-quest-bootstrap-policy";

describe("bootstrap ranking reuse", () => {
  const now = Date.parse("2026-10-11T12:00:00Z");
  it("reuses a recent snapshot or an explicitly absent player profile", () => {
    expect(canReuseKqBootstrapProgress(null, now)).toBe(true);
    expect(canReuseKqBootstrapProgress({ leaderboardGeneratedAt: new Date(now - 90_000).toISOString() }, now)).toBe(true);
  });
  it.each([undefined, {}, { leaderboardGeneratedAt: null }, { leaderboardGeneratedAt: "invalid" },
    { leaderboardGeneratedAt: new Date(now - 90_001).toISOString() },
    { leaderboardGeneratedAt: new Date(now + 60_000).toISOString() },
  ])("refreshes missing, stale or unreliable progress %j", (progress) => {
    expect(canReuseKqBootstrapProgress(progress, now)).toBe(false);
  });
});
