import "server-only";
import { isContestNotebookEnabledServer } from "@/lib/contest-notebook-access";

export function isProductTastingStorefrontEnabled(): boolean {
  return process.env.PRODUCT_TASTING_STOREFRONT_ENABLED?.trim().toLowerCase() !== "false";
}

export function isProductTastingNotebookLinkEnabled(): boolean {
  return isContestNotebookEnabledServer();
}
