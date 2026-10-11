import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startArenaVisiblePolling } from "./arena-visible-polling";
import { getKqStorageRefreshDelay, KQ_STORAGE_REFRESH_MS } from "./kanab-quest-storage-refresh";

const serverNow = "2026-10-11T12:00:00.000Z";
const snapshot = (delays: number[]) => ({ serverNow, lots: delays.map(delay => ({ projection: {
  nextChangeAt: new Date(Date.parse(serverNow) + delay).toISOString(),
} })) });
let page: EventTarget & { hidden: boolean };
beforeEach(() => {
  vi.useFakeTimers();
  page = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal("document", page);
  vi.stubGlobal("window", new EventTarget());
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("warehouse polling budget", () => {
  it("performs 30 periodic reads per visible hour, instead of 120", async () => {
    const task = vi.fn().mockResolvedValue(undefined);
    const stop = startArenaVisiblePolling(task, () => getKqStorageRefreshDelay(snapshot([3_600_000])));
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(task).toHaveBeenCalledTimes(31); // One initial read plus 30 periodic reads.
    stop();
  });
  it("uses the nearest server deadline without trusting the device wall clock", () => {
    vi.setSystemTime(new Date("2037-01-01T00:00:00Z"));
    expect(getKqStorageRefreshDelay(snapshot([50_000, 10_000]), 500)).toBe(9_600);
    expect(getKqStorageRefreshDelay(snapshot([3_600_000]))).toBe(KQ_STORAGE_REFRESH_MS);
    expect(getKqStorageRefreshDelay(snapshot([-1]))).toBe(KQ_STORAGE_REFRESH_MS);
    expect(getKqStorageRefreshDelay(null)).toBe(KQ_STORAGE_REFRESH_MS);
    expect(getKqStorageRefreshDelay(snapshot([10]), 1_000)).toBe(1_000);
  });
  it("reschedules a returned mutation snapshot without an extra read", async () => {
    let delay = KQ_STORAGE_REFRESH_MS;
    const task = vi.fn().mockResolvedValue(undefined);
    const stop = startArenaVisiblePolling(task, () => delay);
    await vi.advanceTimersByTimeAsync(1_000);
    delay = 5_000;
    stop.reschedule();
    await vi.advanceTimersByTimeAsync(4_999);
    expect(task).toHaveBeenCalledTimes(1);
    delay = KQ_STORAGE_REFRESH_MS;
    await vi.advanceTimersByTimeAsync(1);
    expect(task).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(task).toHaveBeenCalledTimes(2);
    stop();
  });
  it("serializes manual, deadline and visibility refreshes and stops in background", async () => {
    let finish!: () => void;
    const task = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const stop = startArenaVisiblePolling(task, KQ_STORAGE_REFRESH_MS);
    void stop.refresh();
    stop.reschedule();
    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(KQ_STORAGE_REFRESH_MS);
    expect(task).toHaveBeenCalledTimes(1);
    page.hidden = true; page.dispatchEvent(new Event("visibilitychange"));
    finish(); await vi.advanceTimersByTimeAsync(3_600_000);
    expect(task).toHaveBeenCalledTimes(1);
    page.hidden = false; page.dispatchEvent(new Event("visibilitychange"));
    expect(task).toHaveBeenCalledTimes(2);
    stop(); finish(); await vi.advanceTimersByTimeAsync(3_600_000);
    expect(task).toHaveBeenCalledTimes(2);
  });
});
