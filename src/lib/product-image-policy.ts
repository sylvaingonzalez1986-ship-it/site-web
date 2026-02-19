export const PRODUCT_IMAGE_PUBLIC_UPLOAD_PREFIX = "/uploads/products/";
export const PRODUCT_IMAGE_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
export const PRODUCT_IMAGE_MAX_COUNT = 3;
export const PRODUCT_IMAGE_ACCEPT_ATTRIBUTE = ".jpg,.jpeg,.png,.webp";

export const PRODUCT_IMAGE_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export type ProductImageMimeType = (typeof PRODUCT_IMAGE_ALLOWED_MIME_TYPES)[number];

export function isSupportedProductImageMimeType(
  mimeType: string,
): mimeType is ProductImageMimeType {
  return PRODUCT_IMAGE_ALLOWED_MIME_TYPES.includes(mimeType as ProductImageMimeType);
}
