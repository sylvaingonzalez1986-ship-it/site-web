export const LOTTERY_CARD_IMAGE_PUBLIC_UPLOAD_PREFIX = "/uploads/lottery-cards/";
export const LOTTERY_CARD_IMAGE_UPLOAD_MAX_BYTES = 30 * 1024 * 1024;
export const LOTTERY_CARD_IMAGE_ACCEPT_ATTRIBUTE = ".jpg,.jpeg,.png,.webp";

export const LOTTERY_CARD_IMAGE_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export type LotteryCardImageMimeType = (typeof LOTTERY_CARD_IMAGE_ALLOWED_MIME_TYPES)[number];

export function isSupportedLotteryCardImageMimeType(
  mimeType: string,
): mimeType is LotteryCardImageMimeType {
  return LOTTERY_CARD_IMAGE_ALLOWED_MIME_TYPES.includes(mimeType as LotteryCardImageMimeType);
}
