import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function browser() {
  const target = new EventTarget();
  const pages = [
    { url: "https://example.test/arene", state: { __NA: true, tree: "arena" } },
    { url: "https://example.test/arene/placard?view=shop", state: { __NA: true, tree: "shop" } },
  ];
  let index = 1;
  const history = {
    get state() { return pages[index].state; },
    pushState(state: typeof pages[number]["state"], _title: string, url?: string) {
      pages.splice(++index, pages.length, { state, url: url ? new URL(url, pages[index - 1].url).href : pages[index - 1].url });
    },
    replaceState(state: typeof pages[number]["state"], _title: string, url?: string) {
      pages[index] = { state, url: url ? new URL(url, pages[index].url).href : pages[index].url };
    },
    go: vi.fn((delta: number) => queueMicrotask(() => { index = Math.max(0, Math.min(pages.length - 1, index + delta)); target.dispatchEvent(new Event("popstate")); })),
  };
  return Object.assign(target, { history, location: { get href() { return pages[index].url; } }, getIndex: () => index });
}
const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

describe("transient overlay browser history", () => {
  beforeEach(() => { vi.resetModules(); vi.stubGlobal("window", browser()); });
  afterEach(() => vi.unstubAllGlobals());

  it("Back closes the collection without changing the activity or Next state", async () => {
    const { registerOverlayHistory } = await import("./overlay-history");
    const close = vi.fn();
    registerOverlayHistory("collection", close);
    window.history.go(-1); await settle();
    expect(close).toHaveBeenCalledOnce();
    expect(window.location.href).toContain("?view=shop");
    expect(window.history.state).toEqual({ __NA: true, tree: "shop" });
  });

  it("only the top window closes on Back", async () => {
    const { registerOverlayHistory } = await import("./overlay-history");
    const parent = vi.fn(), child = vi.fn();
    registerOverlayHistory("producer", parent); registerOverlayHistory("video", child);
    window.history.go(-1); await settle();
    expect(child).toHaveBeenCalledOnce(); expect(parent).not.toHaveBeenCalled();
    window.history.go(-1); await settle(); expect(parent).toHaveBeenCalledOnce();
  });

  it("a direct close retires the entry before navigating, with no phantom Back step", async () => {
    const { registerOverlayHistory, navigateAfterOverlays } = await import("./overlay-history");
    registerOverlayHistory("collection", vi.fn()); registerOverlayHistory("detail", vi.fn());
    navigateAfterOverlays(() => window.history.pushState({ __NA: true }, "", "?view=shop&section=buddies"));
    await settle();
    expect(window.location.href).toContain("section=buddies");
    window.history.go(-1); await settle(); expect(window.location.href).toMatch(/view=shop$/);
    window.history.go(-1); await settle(); expect(window.location.href).toMatch(/\/arene$/);
  });

  it("replaces a closed window with its next step in one render", async () => {
    const { registerOverlayHistory } = await import("./overlay-history");
    const dispose = registerOverlayHistory("duplicates", vi.fn());
    dispose();
    const close = vi.fn(); registerOverlayHistory("burn", close);
    await settle(); expect(close).not.toHaveBeenCalled();
    window.history.go(-1); await settle(); expect(close).toHaveBeenCalledOnce();
    expect(window.history.state).toEqual({ __NA: true, tree: "shop" });
  });

  it("reuses StrictMode effects without adding a second entry", async () => {
    const { registerOverlayHistory } = await import("./overlay-history");
    registerOverlayHistory("dialog", vi.fn())();
    const close = vi.fn(); registerOverlayHistory("dialog", close);
    await settle(); window.history.go(-1); await settle();
    expect(close).toHaveBeenCalledOnce(); expect(window.history.state).toEqual({ __NA: true, tree: "shop" });
  });

  it("does not undo a new route when the old window unmounts", async () => {
    const { registerOverlayHistory } = await import("./overlay-history");
    const dispose = registerOverlayHistory("dialog", vi.fn());
    window.history.pushState({ __NA: true }, "", "/boutique"); dispose(); await settle();
    expect(window.location.href).toMatch(/\/boutique$/); expect(window.history.go).not.toHaveBeenCalled();
  });
});
