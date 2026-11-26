import { afterEach, describe, expect, it, vi } from "vitest";
import { changeShopUrl } from "./shop-panel-history";

function browser(path: string) {
  type Entry = { url: URL; state: unknown };
  const entries: Entry[] = [{ url: new URL(path, "https://shop.test"), state: null }];
  let index = 0;
  const history = {
    get state() { return entries[index].state; },
    pushState: vi.fn((state: unknown, _title: string, href: string) => {
      entries.splice(index + 1, entries.length, { url: new URL(href, entries[index].url), state });
      index += 1;
    }),
    replaceState: vi.fn((state: unknown, _title: string, href: string) => {
      entries[index] = { url: new URL(href, entries[index].url), state };
    }),
    back: vi.fn(() => { index = Math.max(0, index - 1); }),
  };
  const location = { get href() { return entries[index].url.href; } };
  vi.stubGlobal("window", { location, history });
  return { history, location };
}

afterEach(() => vi.unstubAllGlobals());

describe("shop panel history", () => {
  it("gives each nested panel one entry and keeps that entry when switching producers", () => {
    const { history, location } = browser("/boutique?selection=regions");
    changeShopUrl({ region: "bretagne" }, "open");
    changeShopUrl({ producteur: "ty-kanna" }, "open");
    changeShopUrl({ producteur: "les-chanvriers-bretons" }, "switch");
    expect(history.pushState).toHaveBeenCalledTimes(2);
    expect(history.replaceState).toHaveBeenCalledOnce();
    expect(location.href).toContain("producteur=les-chanvriers-bretons");

    changeShopUrl({ producteur: null }, "close");
    expect(location.href).toBe("https://shop.test/boutique?selection=regions&region=bretagne");
    changeShopUrl({ region: null }, "close");
    expect(location.href).toBe("https://shop.test/boutique?selection=regions");
    expect(history.back).toHaveBeenCalledTimes(2);
  });

  it("closes a directly loaded panel in place and preserves the selection", () => {
    const { history, location } = browser("/boutique?selection=neighbors&culture=greenhouse&producteur=ty-kanna&resume=old#shop-card-producer-ty-kanna-a");
    changeShopUrl({ producteur: null }, "close");
    expect(location.href).toBe("https://shop.test/boutique?selection=neighbors&culture=greenhouse");
    expect(history.replaceState).toHaveBeenCalledOnce();
    expect(history.back).not.toHaveBeenCalled();
  });

  it("keeps the current entry if a selected filter is activated again", () => {
    const { history } = browser("/boutique?selection=neighbors&culture=greenhouse&resume=old#shop-card-market-a");
    changeShopUrl({ culture: "greenhouse" });
    expect(history.pushState).not.toHaveBeenCalled();
    expect(history.replaceState).not.toHaveBeenCalled();
  });
});
