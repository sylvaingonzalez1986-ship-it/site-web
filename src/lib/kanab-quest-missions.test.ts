import { describe, expect, it } from "vitest";
import { getKqMissionContinuation, KQ_MISSION_DEFINITIONS, type KqMission, type KqMissionCode, type KqMissionSnapshot } from "./kanab-quest-missions";

function snapshot(claimed: KqMissionCode[] = [], overrides: Partial<Record<KqMissionCode, Partial<KqMission>>> = {}): KqMissionSnapshot {
  return { collectionActive: true, missions: KQ_MISSION_DEFINITIONS.map(definition => ({
    ...definition, progress: 0, rewardAvailable: true, cardCount: definition.reward.kind === "pack" ? definition.reward.cardCount : 0,
    claimed: claimed.includes(definition.code), unlocked: definition.step === 1 || KQ_MISSION_DEFINITIONS.some(previous => previous.track === definition.track && previous.step === definition.step - 1 && claimed.includes(previous.code)),
    claimable: false, entitlementId: null, packAvailable: null, ...overrides[definition.code],
  })) };
}

describe("mission reward continuation", () => {
  it("waits for the server to confirm the received reward instead of repeating its objective", () => {
    expect(getKqMissionContinuation(null, "first-harvest")).toEqual({ status: "pending" });
    expect(getKqMissionContinuation(snapshot(), "first-harvest")).toEqual({ status: "pending" });
    const fresh = snapshot(["first-harvest"], { "three-varieties": { progress: 1 } });
    expect(getKqMissionContinuation(fresh, "first-harvest")).toEqual({ status: "next", mission: fresh.missions[1] });
  });

  it("keeps the same journey even when another journey has an immediately claimable reward", () => {
    const fresh = snapshot(["first-harvest"], { "beautiful-flower": { claimable: true, progress: 1 } });
    const next = getKqMissionContinuation(fresh, "first-harvest");
    expect(next.status === "next" && next.mission.code).toBe("three-varieties");
  });

  it("preserves server claimability and unavailable rewards without calculating them from progress", () => {
    const reached = snapshot(["first-harvest"], { "three-varieties": { progress: 3, claimable: false } });
    const next = getKqMissionContinuation(reached, "first-harvest");
    expect(next.status === "next" && next.mission.claimable).toBe(false);
    const unavailable = snapshot(["first-harvest"], { "three-varieties": { progress: 3, claimable: true, rewardAvailable: false } });
    expect(getKqMissionContinuation(unavailable, "first-harvest")).toEqual({ status: "next", mission: unavailable.missions[1] });
  });

  it("advances past rewards already claimed on another device or in an earlier visit", () => {
    const fresh = snapshot(["first-harvest", "three-varieties", "five-varieties"]);
    const next = getKqMissionContinuation(fresh, "first-harvest");
    expect(next.status === "next" && next.mission.code).toBe("ten-varieties");
  });

  it("does not announce completion from missing missions or invent progress for a locked or malformed next step", () => {
    const incomplete = snapshot(["first-harvest"]);
    incomplete.missions = incomplete.missions.filter(mission => mission.code !== "three-varieties");
    expect(getKqMissionContinuation(incomplete, "first-harvest")).toEqual({ status: "pending" });
    for (const override of [{ unlocked: false }, { progress: undefined }, { progress: Number.NaN }, { target: 0 }]) {
      expect(getKqMissionContinuation(snapshot(["first-harvest"], { "three-varieties": override }), "first-harvest")).toEqual({ status: "pending" });
    }
  });

  it("finishes only the completed journey after its last reward and never returns its old action", () => {
    const claimed = KQ_MISSION_DEFINITIONS.filter(mission => mission.track === "culture").map(mission => mission.code);
    expect(getKqMissionContinuation(snapshot(claimed), "twenty-varieties")).toEqual({ status: "complete", track: "culture" });
    const missing = snapshot(claimed);
    missing.missions = missing.missions.filter(mission => mission.code !== "five-varieties");
    expect(getKqMissionContinuation(missing, "twenty-varieties")).toEqual({ status: "pending" });
  });
});
