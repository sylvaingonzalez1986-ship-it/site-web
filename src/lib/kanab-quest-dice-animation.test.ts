import { afterEach, describe, expect, it, vi } from "vitest";
import { playKqDiceAnimation } from "./kanab-quest-dice-animation";

afterEach(() => vi.useRealTimers());

describe("dice animation fallback", () => {
  it("keeps a successful animation", async () => {
    expect(await playKqDiceAnimation(async () => true)).toBe(true);
  });

  it("falls back when the renderer is unavailable or throws", async () => {
    expect(await playKqDiceAnimation(async () => false)).toBe(false);
    expect(await playKqDiceAnimation(() => { throw new Error("WebGL unavailable"); })).toBe(false);
  });

  it("bounds a stalled animation without launching it again", async () => {
    vi.useFakeTimers();
    const animate = vi.fn(() => new Promise<boolean>(() => {}));
    const result = playKqDiceAnimation(animate);
    await vi.advanceTimersByTimeAsync(7_000);
    expect(await result).toBe(false);
    expect(animate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("releases an interrupted presentation without another call and before timeout", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const animate = vi.fn(() => new Promise<boolean>(() => {}));
    const pending = playKqDiceAnimation(animate, undefined, controller.signal);
    await Promise.resolve();
    controller.abort();
    expect(await pending).toBe(false);
    expect(animate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(await playKqDiceAnimation(animate, undefined, controller.signal)).toBe(false);
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it("handles a late rejection after the fallback", async () => {
    vi.useFakeTimers();
    let rejectAnimation!: (error: Error) => void;
    const result = playKqDiceAnimation(() => new Promise<boolean>((_, reject) => { rejectAnimation = reject; }));
    await vi.advanceTimersByTimeAsync(7_000);
    expect(await result).toBe(false);
    rejectAnimation(new Error("Late renderer error"));
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
  });
});
