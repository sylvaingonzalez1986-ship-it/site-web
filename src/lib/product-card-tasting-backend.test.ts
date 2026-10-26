import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ summaries: vi.fn() }));
vi.mock("@/lib/contest-backend", () => ({ getContestProductTastingSummaries: mocks.summaries, isContestSchemaMissingError: () => false }));
import { getProductCardTastingSummaries } from "./product-card-tasting-backend";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("CONTEST_FEATURE_ENABLED", "false");
  vi.stubEnv("CONTEST_FEATURE_ALLOW_PRODUCTION", "false");
  vi.stubEnv("CONTEST_BETA_ACCESS_ENABLED", "true");
  vi.stubEnv("CONTEST_NOTEBOOK_ENABLED", undefined);
  vi.stubEnv("PRODUCT_TASTING_STOREFRONT_ENABLED", undefined);
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-25T12:00:00+01:00"));
  mocks.summaries.mockResolvedValue([{
    entry: { id: "flower-lot", productId: "flower", track: "concours", season: { code: "2026" }, stats: { approvedReviewCount: 0 } },
    reviews: [],
    nextReviewCursor: null,
  }]);
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("public market tasting entry points", () => {
  it("exposes a selected flower's rating form even with no reviews and the game still closed", async () => {
    const summaries = await getProductCardTastingSummaries(["flower"]);
    expect(mocks.summaries).toHaveBeenCalledWith(["flower"], 2);
    expect(summaries.flower.notebookHref).toBe("/arene/carnet/concours?entry=flower-lot&season=2026&edit=notes");
    expect(summaries.flower.reviews).toEqual([]);
  });

  it.each(["CONTEST_NOTEBOOK_ENABLED", "PRODUCT_TASTING_STOREFRONT_ENABLED"])("respects an explicit %s opt-out", async flag => {
    vi.stubEnv(flag, "false");
    expect(await getProductCardTastingSummaries(["flower"])).toEqual({});
    expect(mocks.summaries).not.toHaveBeenCalled();
  });
});
