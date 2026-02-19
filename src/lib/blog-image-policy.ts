export const BLOG_IMAGE_PUBLIC_UPLOAD_PREFIX = "/uploads/blog/";
export const BLOG_IMAGE_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
export const BLOG_IMAGE_ACCEPT_ATTRIBUTE = ".jpg,.jpeg,.png,.webp";

export const BLOG_IMAGE_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export type BlogImageMimeType = (typeof BLOG_IMAGE_ALLOWED_MIME_TYPES)[number];

export function isSupportedBlogImageMimeType(
  mimeType: string,
): mimeType is BlogImageMimeType {
  return BLOG_IMAGE_ALLOWED_MIME_TYPES.includes(mimeType as BlogImageMimeType);
}

