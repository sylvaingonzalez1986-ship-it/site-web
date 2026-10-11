import { afterEach, describe, expect, it, vi } from "vitest";
import type { KqOfficialFlower, KqStorageSnapshot } from "./kanab-quest-api";
import { getKqHarvestRows } from "./kanab-quest-harvests";
import { createKqOperationsLesson, getKqOperationsStorage } from "./kanab-quest-operations-lesson";
import { createKqStorageLot, planKqStorageAllocation, projectKqStorageLot } from "./kanab-quest-storage";

const now = Date.parse("2026-10-10T10:00:00Z");
const lesson = createKqOperationsLesson("warehouse");
function flower(id: string, status: KqOfficialFlower["status"]): KqOfficialFlower {
  return { id, runId: `run-${id}`, varietyCode: lesson.storage.lot.baseline.varietyCode, varietyName: id,
    quality: 70, stats: {}, traits: [], combos: [], status, createdAt: new Date(now).toISOString(),
    queuedAt: null, lockedAt: null, burnedAt: null };
}
function snapshot(): KqStorageSnapshot {
  const lots = [{ id: "curing", age: 30, units: 500 }, { id: "ready", age: 420, units: 500 }, { id: "overflow", age: 30, units: 1800 }].map(({ id, age, units }) => {
    const started = now - age * 60_000;
    const raw = createKqStorageLot({ flowerId: id, harvestedAt: new Date(started).toISOString(),
      baseline: lesson.storage.lot.baseline,
      capacity: planKqStorageAllocation({ totalUnits: units, ownedContainers: { "GLASS-1L": 2 }, nowMs: started }),
    });
    return { flowerId: id, varietyName: id, harvestGrams: units / 10, flowerStatus: "burned", projection: projectKqStorageLot(raw, now) };
  });
  return { ...getKqOperationsStorage(lesson), serverNow: new Date(now).toISOString(), lots };
}

afterEach(() => vi.useRealTimers());
describe("harvest navigation state", () => {
  it("puts unprotected surplus first and separates jury, active duel, queue, ready stock and curing", () => {
    const rows = getKqHarvestRows([flower("queued", "queued"), flower("jury", "available"), flower("locked", "locked")], snapshot());
    expect(rows.map(({ id, state }) => [id, state])).toEqual([
      ["overflow", "overflow"], ["jury", "jury"], ["locked", "duel"], ["queued", "queued"], ["ready", "ready"], ["curing", "curing"],
    ]);
    expect(rows.find(row => row.id === "locked")?.flower?.id).toBe("locked");
    expect(rows.find(row => row.id === "queued")?.flower?.id).toBe("queued");
  });

  it("keeps one harvest identity when the flower endpoint is older than storage", () => {
    const rows = getKqHarvestRows([flower("ready", "available"), flower("curing", "burned"), flower("sold", "burned")], snapshot());
    expect(rows.map(row => row.id)).toEqual(["overflow", "ready", "curing"]);
    expect(rows.find(row => row.id === "ready")?.lot?.flowerId).toBe("ready");
    expect(rows.find(row => row.id === "ready")?.flower).toBeUndefined();
  });

  it("retains the available source during a partial API failure", () => {
    expect(getKqHarvestRows([flower("jury", "available")], null).map(row => row.id)).toEqual(["jury"]);
    expect(getKqHarvestRows([], snapshot()).map(row => row.id)).toEqual(["overflow", "ready", "curing"]);
    expect(getKqHarvestRows([], null)).toEqual([]);
  });

  it("uses the server projection without aging or modifying stock on the player's device", () => {
    const storage = snapshot(), before = structuredClone(storage);
    vi.useFakeTimers();vi.setSystemTime(new Date("2099-12-31T23:59:59Z"));
    expect(getKqHarvestRows([], storage).find(row => row.id === "curing")?.state).toBe("curing");
    expect(storage).toEqual(before);
  });
});
