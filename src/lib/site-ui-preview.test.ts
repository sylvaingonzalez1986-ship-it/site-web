import { afterEach, describe, expect, it, vi } from "vitest";
import { getSiteUiVariants, isSiteUiPreviewEnabled, siteUiVariant } from "./site-ui-preview";

afterEach(() => vi.unstubAllEnvs());

describe("site UI rollout", () => {
  it.each([undefined, "0", "1"])("uses Quartier in production with SITE_UI_PREVIEW=%s, including old comparison cookies", (flag) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SITE_UI_PREVIEW", flag);

    expect(siteUiVariant()).toBe("quartier");
    expect(siteUiVariant("original")).toBe("quartier");
    expect(isSiteUiPreviewEnabled()).toBe(false);
  });

  it("allows the original comparison only when development tools are enabled", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SITE_UI_PREVIEW", "1");
    expect(isSiteUiPreviewEnabled()).toBe(true);
    expect(siteUiVariant("original")).toBe("original");

    vi.stubEnv("SITE_UI_PREVIEW", "0");
    expect(isSiteUiPreviewEnabled()).toBe(false);
    expect(siteUiVariant("original")).toBe("quartier");
  });

  it.each(["/", "/boutique", "/boutique/fleurs/test", "/blog", "/compte/connexion", "/profil/collection", "/age-gate"])("applies Quartier to public content and navigation on %s", (pathname) => {
    expect(getSiteUiVariants(pathname, "quartier")).toEqual({ content: "quartier", navigation: "quartier", allowPreview: true });
  });

  it.each(["/arene", "/arene/test", "/bete-de-concours", "/bete-de-concours/profils/test"])("keeps the game's own materials and the new navigation on %s", (pathname) => {
    expect(getSiteUiVariants(pathname, "quartier")).toEqual({ content: "original", navigation: "quartier", allowPreview: false });
  });

  it.each(["/admin", "/admin/login", "/dev/placard"])("keeps development and admin tools separate on %s", (pathname) => {
    expect(getSiteUiVariants(pathname, "quartier")).toEqual({ content: "original", navigation: "original", allowPreview: false });
  });
});
