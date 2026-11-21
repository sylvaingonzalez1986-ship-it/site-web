import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consumeVillageSupportView, saveVillageSupportView, VILLAGE_SUPPORT_VIEW_KEY } from "./village-support-view";

const storage = new Map<string, string>();
const pose = { target: [-5, 2, -12] as [number, number, number], radius: 56, phi: Math.PI / 3, theta: -1.4, zoomRatio: 1.25 };

beforeEach(() => {
  storage.clear();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the Quarter camera on return from payment", () => {
  it("uses a fresh pose once per tab", () => {
    saveVillageSupportView(pose);
    expect(consumeVillageSupportView()).toMatchObject(pose);
    expect(consumeVillageSupportView()).toBeNull();
  });

  it("expires a pose and discards invalid coordinates", () => {
    vi.useFakeTimers();
    saveVillageSupportView(pose);
    vi.advanceTimersByTime(60 * 60 * 1000 + 1);
    expect(consumeVillageSupportView()).toBeNull();
    storage.set(VILLAGE_SUPPORT_VIEW_KEY, JSON.stringify({ ...pose, target: [900, 0, null], savedAt: Date.now() }));
    expect(consumeVillageSupportView()).toBeNull();
    expect(storage.has(VILLAGE_SUPPORT_VIEW_KEY)).toBe(false);
  });
});
