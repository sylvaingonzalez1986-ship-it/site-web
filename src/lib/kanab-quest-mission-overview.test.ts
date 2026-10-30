import { describe, expect, it } from "vitest";
import { KQ_MISSION_DEFINITIONS, type KqMission, type KqMissionCode } from "./kanab-quest-missions";
import { getKqMissionOverview, isKqMissionRewardUnavailable } from "./kanab-quest-mission-overview";

function mission(code: KqMissionCode, changes: Partial<KqMission> = {}): KqMission {
  const definition = KQ_MISSION_DEFINITIONS.find(item => item.code === code)!;
  return { ...definition, rewardAvailable: true, cardCount: 0, progress: 0, claimed: false, unlocked: true, claimable: false, entitlementId: null, packAvailable: false, ...changes };
}
const overview = (missions: KqMission[], collectionActive = true) => getKqMissionOverview({ missions, collectionActive });

describe("mission overview", () => {
  it("puts a claimable reward before ongoing tracks without changing equal-priority catalogue order", () => {
    const result = overview([mission("first-online-sale", { claimable: true }), mission("beautiful-flower"), mission("first-harvest")]);
    expect(result.tracks.map(item => item.track)).toEqual(["online", "culture", "quality"]);
    expect(result.ready).toBe(1);
  });
  it("does not promote a later step before its predecessor is claimed", () => {
    const result = overview([mission("three-varieties", { claimable: true, progress: 3 }), mission("first-harvest")]);
    expect(result.tracks[0].current?.code).toBe("first-harvest");
    expect(result.ready).toBe(0);
  });
  it("keeps locked steps locked even when a conflicting flag says claimable", () => {
    expect(overview([mission("first-harvest", { unlocked: false, claimable: true })]).tracks[0].state).toBe("locked");
  });
  it("separates unavailable rewards from rewards that can actually be recovered", () => {
    const result = overview([mission("first-harvest", { claimable: true, rewardAvailable: false })]);
    expect(result).toMatchObject({ ready: 0, unavailable: 1, claimed: 0, total: 1 });
  });
  it("allows cash without an active card collection and respects an explicit server restriction", () => {
    expect(isKqMissionRewardUnavailable(mission("first-harvest"), false)).toBe(false);
    expect(isKqMissionRewardUnavailable(mission("first-harvest", { rewardAvailable: false }), false)).toBe(true);
    expect(isKqMissionRewardUnavailable(mission("five-varieties", { rewardAvailable: undefined }), false)).toBe(true);
  });
  it("preserves availability of a legacy pack rather than substituting the current catalogue reward", () => {
    expect(isKqMissionRewardUnavailable(mission("first-harvest", { reward: undefined, cardCount: 3, rewardAvailable: undefined }), false)).toBe(true);
    expect(isKqMissionRewardUnavailable(mission("first-harvest", { reward: undefined, cardCount: 3, rewardAvailable: true }), false)).toBe(false);
  });
  it("places completed tracks last and does not manufacture missing tracks", () => {
    const result = overview([mission("first-harvest", { claimed: true }), mission("first-prepared")]);
    expect(result.tracks.map(item => item.state)).toEqual(["active", "complete"]);
    expect(result).toMatchObject({ claimed: 1, total: 2, ready: 0 });
  });
  it("returns an empty overview for an empty server snapshot", () => {
    expect(overview([])).toEqual({ tracks: [], claimed: 0, ready: 0, unavailable: 0, total: 0 });
  });
});
