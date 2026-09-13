import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startArenaVisiblePolling } from "./arena-visible-polling";

let page: EventTarget & { hidden: boolean };
beforeEach(() => {
  vi.useFakeTimers();
  page = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal("document", page);
  vi.stubGlobal("window", new EventTarget());
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Arena polling cost and lifecycle", () => {
  it("uses 41 lightweight checks over 20 minutes instead of 303 list/queue calls", async () => {
    const task = vi.fn().mockResolvedValue(undefined);
    const stop = startArenaVisiblePolling(task);
    await vi.advanceTimersByTimeAsync(20 * 60_000);
    expect(task).toHaveBeenCalledTimes(41);
    expect(1 - task.mock.calls.length / 303).toBeGreaterThan(.85);
    stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(task).toHaveBeenCalledTimes(41);
  });
  it("pauses hidden tabs and resumes without parallel requests or catch-up bursts", async () => {
    let finish!: () => void;
    const task = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const stop = startArenaVisiblePolling(task);
    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(task).toHaveBeenCalledTimes(1);
    page.hidden = true; page.dispatchEvent(new Event("visibilitychange"));
    finish(); await vi.advanceTimersByTimeAsync(600_000);
    expect(task).toHaveBeenCalledTimes(1);
    page.hidden = false; page.dispatchEvent(new Event("visibilitychange"));
    expect(task).toHaveBeenCalledTimes(2);
    stop(); finish(); await vi.advanceTimersByTimeAsync(120_000);
    window.dispatchEvent(new Event("focus"));
    expect(task).toHaveBeenCalledTimes(2);
  });
  it("does not start hidden and retries errors at the normal interval", async () => {
    page.hidden = true;
    const task = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const stop = startArenaVisiblePolling(task);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(task).not.toHaveBeenCalled();
    page.hidden = false; page.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(task).toHaveBeenCalledTimes(2);
    stop();
  });
});
