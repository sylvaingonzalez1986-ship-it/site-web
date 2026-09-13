import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  entries: new Map<string, { expires: number; value: Promise<unknown> }>(),
  settings: vi.fn(), invalidate: vi.fn(),
}));
vi.mock("next/cache", () => ({
  unstable_cache: (loader: () => Promise<unknown>, keys: string[], options: { revalidate: number; tags: string[] }) => {
    mocks.settings(keys, options);
    return () => {
      const key = keys.join(":"), previous = mocks.entries.get(key);
      if (previous && previous.expires > Date.now()) return previous.value;
      const value = loader(); mocks.entries.set(key, { value, expires: Date.now() + options.revalidate * 1000 });
      void value.catch(() => mocks.entries.delete(key));
      return value;
    };
  },
  revalidateTag: (...args: unknown[]) => { mocks.invalidate(...args); mocks.entries.clear(); },
}));
import { cacheArenaSharedRead, invalidateArenaSharedReads } from "./arena-shared-cache";
beforeEach(() => { mocks.entries.clear(); vi.clearAllMocks(); });

describe("shared Arena read cache", () => {
  it("shares a common read between 100 callers and isolates different read models", async () => {
    const load = vi.fn().mockResolvedValue({ total: 12 });
    const cached = cacheArenaSharedRead("standings", load);
    await Promise.all(Array.from({ length: 100 }, () => cached()));
    await cached();
    expect(load).toHaveBeenCalledTimes(1);
    await cacheArenaSharedRead("other-season", load)();
    expect(load).toHaveBeenCalledTimes(2);
    expect(mocks.settings).toHaveBeenCalledWith(expect.any(Array), { revalidate: 30, tags: ["arena-shared-read-v1"] });
  });
  it("invalidates after an explicit mutation and never retains a failed read", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(2).mockResolvedValueOnce(3);
    const cached = cacheArenaSharedRead("rewards", load);
    await expect(cached()).rejects.toThrow("offline");
    await expect(cached()).resolves.toBe(2);
    invalidateArenaSharedReads();
    await expect(cached()).resolves.toBe(3);
    expect(mocks.invalidate).toHaveBeenCalledWith("arena-shared-read-v1", { expire: 0 });
  });
});
