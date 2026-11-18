import { describe, expect, it } from "vitest";
import { emptyFarmProgress, pauseFarmProgress, replayFarmStep, resumeFarmProgress, type FarmProgress } from "./kanab-quest-farm-progress";
import { farmPreferenceStorageKey, farmProgressStorageKey, initializeFarmProgress, loadFarmProgress, saveFarmProgress } from "./kanab-quest-farm-persistence";

function memoryStorage(initial: Record<string, string> = {}) {
  const rows = new Map(Object.entries(initial));
  return { rows, getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => { rows.set(key, value); } };
}
const learned = (): FarmProgress => ({ ...emptyFarmProgress(), active: true, started: true, completed: ["welcome", "zone", "harvest"], flowerId: "harvest-1" });

describe("durable tutorial preferences", () => {
  it("auto-opens only a new guide and honors a saved pause on reload", () => {
    expect(initializeFarmProgress(null, true).state).toMatchObject({ active: true, started: true });
    const paused = pauseFarmProgress(learned());
    expect(initializeFarmProgress(JSON.stringify(paused), true).state).toEqual(paused);
  });

  it("keeps progress, replays and pauses isolated by account", () => {
    const storage = memoryStorage();
    const replay = replayFarmStep(learned(), "harvest");
    expect(saveFarmProgress(storage, "alice", replay)).toBe(true);
    expect(loadFarmProgress(storage, "alice").state).toEqual(replay);
    expect(loadFarmProgress(storage, "bob").state).toEqual(emptyFarmProgress());
    const paused = pauseFarmProgress(replay);
    expect(saveFarmProgress(storage, "alice", paused)).toBe(true);
    expect(loadFarmProgress(storage, "alice", true).state).toEqual(paused);
    expect(resumeFarmProgress(paused)).toMatchObject({ active: true, completed: learned().completed });
    expect(resumeFarmProgress(paused).replayStepId).toBeUndefined();
  });

  it.each(['{"version":99,"valuable":"future data"}', '{broken'])('preserves unsupported data and still remembers a pause: %s', raw => {
    const storage = memoryStorage({ [farmProgressStorageKey("alice")]: raw });
    const initial = loadFarmProgress(storage, "alice", true);
    expect(initial).toMatchObject({ writable: false, warning: true });
    const paused = pauseFarmProgress(resumeFarmProgress(initial.state));
    expect(saveFarmProgress(storage, "alice", paused, initial.writable)).toBe(true);
    expect(storage.rows.get(farmProgressStorageKey("alice"))).toBe(raw);
    expect(loadFarmProgress(storage, "alice", true).state).toMatchObject({ active: false, started: true, collapsed: true });
  });

  it("retains the independent pause when storing the progress fails", () => {
    const storage = memoryStorage();
    const failing = { ...storage, setItem: (key: string, value: string) => {
      if (key === farmProgressStorageKey("alice")) throw new Error("quota");
      storage.setItem(key, value);
    } };
    expect(saveFarmProgress(failing, "alice", pauseFarmProgress(learned()))).toBe(false);
    expect(loadFarmProgress(storage, "alice", true).state).toMatchObject({ active: false, started: true });
    expect(storage.rows.has(farmPreferenceStorageKey("alice"))).toBe(true);
  });

  it("reports inaccessible storage without overwriting an unreadable value", () => {
    const storage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(loadFarmProgress(storage, "alice", true)).toMatchObject({ writable: false, warning: true, state: { active: true, started: true } });
    expect(saveFarmProgress(storage, "alice", learned(), false)).toBe(false);
  });
});
