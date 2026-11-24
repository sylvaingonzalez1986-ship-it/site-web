import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createShopImpressionDwell,
  getShopListFilters,
  isLocalShopMeasurementHost,
  registerShopCartAdditionReporter,
  reportShopCartAddition,
} from "./shop-measurement";
import { protectVercelAnalyticsUrls } from "./vercel-analytics-privacy";

afterEach(() => vi.useRealTimers());

describe("shop measurement preview", () => {
  it("requires one continuous second and does not extend it on repeated eligible observations", () => {
    vi.useFakeTimers();
    const visible = vi.fn();
    const update = createShopImpressionDwell(visible);

    update(true);
    vi.advanceTimersByTime(700);
    update(false);
    vi.advanceTimersByTime(500);
    expect(visible).not.toHaveBeenCalled();

    update(true);
    vi.advanceTimersByTime(800);
    update(true);
    vi.advanceTimersByTime(199);
    expect(visible).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(visible).toHaveBeenCalledOnce();
  });

  it("reports only valid public catalog identifiers while the local reporter is installed", () => {
    const report = vi.fn();
    reportShopCartAddition(null, "product-123");
    expect(report).not.toHaveBeenCalled();

    const unregister = registerShopCartAdditionReporter(report);
    try {
      reportShopCartAddition(null, "product-123", "5-g");
      reportShopCartAddition(null, "product-123::1-g");
      reportShopCartAddition(null, "product-123");
      reportShopCartAddition(null, "https://somewhere.example/123");
      reportShopCartAddition(null, "product-123", "email@example.org");
      expect(report.mock.calls).toEqual([
        [null, "product-123", "5-g"],
        [null, "product-123", "1-g"],
        [null, "product-123", null],
      ]);
    } finally {
      unregister();
    }
    reportShopCartAddition(null, "product-123");
    expect(report).toHaveBeenCalledTimes(3);
  });

  it("limits the local hostname to loopback", () => {
    expect(["localhost", "127.0.0.1", "[::1]"].every(isLocalShopMeasurementHost)).toBe(true);
    expect(isLocalShopMeasurementHost("localhost.example.com")).toBe(false);
    expect(isLocalShopMeasurementHost("www.leschanvriersbretons.com")).toBe(false);
  });

  it("keeps the same list view when only the resume token or campaign changes", () => {
    const before = new URLSearchParams("selection=neighbors&culture=greenhouse&resume=entry1");
    const after = new URLSearchParams("selection=neighbors&culture=greenhouse&resume=entry2&utm_source=example");
    expect(getShopListFilters(before)).toEqual(getShopListFilters(after));
    after.set("culture", "outdoor");
    expect(getShopListFilters(before)).not.toEqual(getShopListFilters(after));
  });
});

describe("Vercel Analytics URL filtering", () => {
  it("removes every resume parameter from views and custom events", () => {
    for (const type of ["pageview", "event"] as const) {
      expect(protectVercelAnalyticsUrls({
        type,
        url: "https://example.com/boutique?selection=neighbors&resume=entry1&resume=entry2#avis",
      })).toEqual({ type, url: "https://example.com/boutique?selection=neighbors#avis" });
    }
  });

  it("keeps newsletter links excluded and preserves unrelated events", () => {
    expect(protectVercelAnalyticsUrls({ type: "pageview", url: "https://example.com/newsletter/a-secret" })).toBeNull();
    const view = { type: "pageview" as const, url: "https://example.com/boutique?categorie=fleurs" };
    expect(protectVercelAnalyticsUrls(view)).toBe(view);
  });
});
