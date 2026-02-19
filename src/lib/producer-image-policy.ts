export const PRODUCER_IMAGE_PUBLIC_UPLOAD_PREFIX = "/uploads/producers/";
export const PRODUCER_IMAGE_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
export const PRODUCER_IMAGE_ACCEPT_ATTRIBUTE = ".jpg,.jpeg,.png,.webp";

export const PRODUCER_IMAGE_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export type ProducerImageMimeType = (typeof PRODUCER_IMAGE_ALLOWED_MIME_TYPES)[number];

export function isSupportedProducerImageMimeType(
  mimeType: string,
): mimeType is ProducerImageMimeType {
  return PRODUCER_IMAGE_ALLOWED_MIME_TYPES.includes(mimeType as ProducerImageMimeType);
}

