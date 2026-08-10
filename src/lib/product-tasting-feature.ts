import "server-only";

export function isProductTastingStorefrontEnabled(): boolean {
  return process.env.PRODUCT_TASTING_STOREFRONT_ENABLED?.trim().toLowerCase() === "true";
}
