export const PRODUCT_VIDEO_PUBLIC_UPLOAD_PREFIX = "/uploads/product-videos/";
export const PRODUCT_VIDEO_UPLOAD_MAX_BYTES = 30 * 1024 * 1024;
export const PRODUCT_VIDEO_ALLOWED_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
] as const;
export type ProductVideoMimeType = (typeof PRODUCT_VIDEO_ALLOWED_MIME_TYPES)[number];

export function isSupportedProductVideoMimeType(
  value: string,
): value is ProductVideoMimeType {
  return PRODUCT_VIDEO_ALLOWED_MIME_TYPES.includes(value as ProductVideoMimeType);
}
