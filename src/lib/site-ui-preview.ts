export const SITE_UI_COOKIE = "site-contours-preview";
export const SITE_UI_PATHNAME_HEADER = "x-site-ui-pathname";
export type SiteUiVariant = "original" | "quartier";

export function siteUiVariant(value?: string): SiteUiVariant {
  return isSiteUiPreviewEnabled() && value === "original" ? "original" : "quartier";
}

/** Only the comparison tools are optional. The public site always uses Quartier. */
export function isSiteUiPreviewEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.SITE_UI_PREVIEW !== "0";
}

export function getSiteUiVariants(pathname: string, variant: SiteUiVariant) {
  const excluded = /^\/(?:arene|bete-de-concours|admin|dev)(?:\/|$)/.test(pathname);
  const navigationExcluded = /^\/(?:admin|dev)(?:\/|$)/.test(pathname);
  return {
    content: excluded ? "original" : variant,
    navigation: navigationExcluded ? "original" : variant,
    allowPreview: !excluded,
  };
}
