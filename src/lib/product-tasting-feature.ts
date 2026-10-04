import "server-only";
import { isArenaPrelaunch } from "@/lib/arena-opening";
import { isContestBetaAccessRestrictedServer, isContestFeatureEnabledServer } from "@/lib/contest-feature";

export function isProductTastingStorefrontEnabled(): boolean {
  return process.env.PRODUCT_TASTING_STOREFRONT_ENABLED?.trim().toLowerCase() === "true";
}

export function isProductTastingNotebookLinkEnabled(): boolean {
  return isContestFeatureEnabledServer() && !isContestBetaAccessRestrictedServer() && !isArenaPrelaunch();
}
