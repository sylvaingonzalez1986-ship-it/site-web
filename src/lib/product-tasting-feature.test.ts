import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ enabled: vi.fn(() => true), restricted: vi.fn(() => false) }));
vi.mock("@/lib/contest-feature", () => ({ isContestFeatureEnabledServer: mocks.enabled, isContestBetaAccessRestrictedServer: mocks.restricted }));
import { ARENA_OPENING_AT } from "./arena-opening";
import { isProductTastingNotebookLinkEnabled } from "./product-tasting-feature";

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); mocks.enabled.mockReturnValue(true); mocks.restricted.mockReturnValue(false); });
describe("storefront notebook links", () => {
  it("opens public notebook links exactly at the existing production opening date", () => {
    vi.stubEnv("NODE_ENV", "production");
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(Date.parse(ARENA_OPENING_AT) - 1);
    expect(isProductTastingNotebookLinkEnabled()).toBe(false);
    now.mockReturnValue(Date.parse(ARENA_OPENING_AT));
    expect(isProductTastingNotebookLinkEnabled()).toBe(true);
    mocks.restricted.mockReturnValue(true);
    expect(isProductTastingNotebookLinkEnabled()).toBe(false);
    mocks.restricted.mockReturnValue(false);
    mocks.enabled.mockReturnValue(false);
    expect(isProductTastingNotebookLinkEnabled()).toBe(false);
  });
});
