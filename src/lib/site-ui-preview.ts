export const SITE_UI_COOKIE = "site-contours-preview";
export type SiteUiVariant = "original" | "quartier";

export function siteUiVariant(value?: string): SiteUiVariant {
  return value === "original" ? "original" : "quartier";
}

/** The experiment stays local unless explicitly enabled for a preview deployment. */
export function isSiteUiPreviewEnabled() {
  return process.env.SITE_UI_PREVIEW === "1" || (process.env.NODE_ENV !== "production" && process.env.SITE_UI_PREVIEW !== "0");
}
