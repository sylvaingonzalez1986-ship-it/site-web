import { afterEach, describe, expect, it, vi } from "vitest";
import { ARENA_OPENING_AT } from "./arena-opening";
import { isProductTastingNotebookLinkEnabled, isProductTastingStorefrontEnabled } from "./product-tasting-feature";

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe("storefront notebook links", () => {
  it("opens the notebook before the game opening even with game features disabled or beta-restricted", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CONTEST_NOTEBOOK_ENABLED", undefined);
    vi.stubEnv("CONTEST_FEATURE_ENABLED", "false");
    vi.stubEnv("CONTEST_FEATURE_ALLOW_PRODUCTION", "false");
    vi.stubEnv("CONTEST_BETA_ACCESS_ENABLED", "true");
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(Date.parse(ARENA_OPENING_AT) - 1);
    expect(isProductTastingNotebookLinkEnabled()).toBe(true);
    now.mockReturnValue(Date.parse(ARENA_OPENING_AT));
    expect(isProductTastingNotebookLinkEnabled()).toBe(true);
  });

  it("respects the notebook emergency switch independently of the game", () => {
    vi.stubEnv("CONTEST_NOTEBOOK_ENABLED", "false");
    expect(isProductTastingNotebookLinkEnabled()).toBe(false);
  });

  it("shows storefront notes by default while preserving an explicit opt-out", () => {
    vi.stubEnv("PRODUCT_TASTING_STOREFRONT_ENABLED", undefined);
    expect(isProductTastingStorefrontEnabled()).toBe(true);
    vi.stubEnv("PRODUCT_TASTING_STOREFRONT_ENABLED", "false");
    expect(isProductTastingStorefrontEnabled()).toBe(false);
  });
});
