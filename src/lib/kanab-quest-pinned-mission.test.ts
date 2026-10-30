import { describe, expect, it } from "vitest";
import { getKqMissionTarget, kqPinnedMissionKey, readKqPinnedMission, readKqPinnedMissionProgress, writeKqPinnedMission } from "./kanab-quest-pinned-mission";

const memory = () => {
  const rows = new Map<string, string>();
  return { getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => { rows.set(key, value); } };
};

describe("pinned mission preference", () => {
  it("never inherits another account's goal, and removes only the current preference", () => {
    const storage = memory();
    expect(writeKqPinnedMission(storage, "alice", "first-curing")).toBe(true);
    expect(readKqPinnedMission(storage, "bob").code).toBeNull();
    writeKqPinnedMission(storage, "bob", "first-prepared");
    writeKqPinnedMission(storage, "alice", null);
    expect(readKqPinnedMission(storage, "alice").code).toBeNull();
    expect(readKqPinnedMission(storage, "bob").code).toBe("first-prepared");
  });
  it("rejects foreign versions and unknown goals without choosing a replacement", () => {
    const storage = memory();
    for (const saved of [{ version: 2, code: "first-curing" }, { version: 1, code: "invented" }]) {
      storage.setItem(kqPinnedMissionKey("alice"), JSON.stringify(saved));
      expect(readKqPinnedMission(storage, "alice").code).toBeNull();
    }
  });
  it("reports blocked persistence so the UI can keep an explicit temporary choice", () => {
    const storage = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
    expect(readKqPinnedMission(storage, "alice")).toEqual({ code: null, unavailable: true });
    expect(writeKqPinnedMission(storage, "alice", "first-curing")).toBe(false);
  });
});

describe("pinned mission facts and destinations", () => {
  const mission = { code: "first-curing", progress: 0, target: 1, claimable: false, claimed: false, unlocked: true };
  it("distinguishes real zero from missing or invalid progress", () => {
    expect(readKqPinnedMissionProgress({ missions: [mission] }, "first-curing")?.progress).toBe(0);
    for (const snapshot of [null, { missions: [] }, { missions: [{ ...mission, progress: null }] }, { missions: [{ ...mission, progress: NaN }] }, { missions: [{ ...mission, target: 0 }] }, { missions: [{ ...mission, claimed: undefined }] }]) {
      expect(readKqPinnedMissionProgress(snapshot, "first-curing")).toBeNull();
    }
  });
  it("keeps server claim eligibility separate from the progress counter", () => {
    expect(readKqPinnedMissionProgress({ missions: [{ ...mission, progress: 1 }] }, "first-curing")?.claimable).toBe(false);
  });
  it("opens storage, preparation and demand tasks in their actual destinations", () => {
    expect(getKqMissionTarget("first-curing")).toEqual({ view: "harvests", options: { harvestSection: "storage" } });
    expect(getKqMissionTarget("first-transformation")).toEqual({ view: "market", options: { marketSection: "sales" } });
    expect(getKqMissionTarget("online-aroma-duo")).toEqual({ view: "market", options: { marketSection: "demands" } });
    expect(getKqMissionTarget("first-online-sale")).toEqual({ view: "market", options: { marketSection: "dashboard" } });
    expect(getKqMissionTarget("beautiful-flower")).toEqual({ view: "game" });
  });
});
