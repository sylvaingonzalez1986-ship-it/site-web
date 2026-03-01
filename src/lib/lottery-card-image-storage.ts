import "server-only";

import { randomUUID } from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import {
  LOTTERY_CARD_IMAGE_UPLOAD_MAX_BYTES,
  isSupportedLotteryCardImageMimeType,
} from "@/lib/lottery-card-image-policy";

const LOTTERY_CARD_IMAGE_BUCKET = "lottery-cards";

type DetectedImageType = {
  extension: "jpg" | "png" | "webp";
  mimeType: "image/jpeg" | "image/png" | "image/webp";
};

export class LotteryCardImageUploadError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "LotteryCardImageUploadError";
  }
}

function sanitizeMimeType(mimeType: string): string {
  if (mimeType === "image/jpg") {
    return "image/jpeg";
  }

  return mimeType;
}

function detectImageType(bytes: Uint8Array): DetectedImageType | null {
  if (bytes.length >= 8) {
    const isPng =
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a;

    if (isPng) {
      return { extension: "png", mimeType: "image/png" };
    }
  }

  if (bytes.length >= 3) {
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (isJpeg) {
      return { extension: "jpg", mimeType: "image/jpeg" };
    }
  }

  if (bytes.length >= 12) {
    const isWebp =
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50;

    if (isWebp) {
      return { extension: "webp", mimeType: "image/webp" };
    }
  }

  return null;
}

export async function saveLotteryCardImageUpload(file: File): Promise<string> {
  if (file.size <= 0) {
    throw new LotteryCardImageUploadError("Fichier vide.", 400);
  }

  if (file.size > LOTTERY_CARD_IMAGE_UPLOAD_MAX_BYTES) {
    throw new LotteryCardImageUploadError("Fichier trop volumineux.", 413);
  }

  const sanitizedMimeType = sanitizeMimeType(file.type);
  if (!isSupportedLotteryCardImageMimeType(sanitizedMimeType)) {
    throw new LotteryCardImageUploadError("Type de fichier non autorise.", 415);
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const detected = detectImageType(bytes);

  if (!detected) {
    throw new LotteryCardImageUploadError("Format d'image invalide.", 415);
  }

  if (detected.mimeType !== sanitizedMimeType) {
    throw new LotteryCardImageUploadError("Le contenu du fichier ne correspond pas au type declare.", 415);
  }

  const fileName = `${randomUUID()}.${detected.extension}`;
  const supabase = createSupabaseServiceClient();
  const uploadResult = await supabase.storage
    .from(LOTTERY_CARD_IMAGE_BUCKET)
    .upload(fileName, Buffer.from(arrayBuffer), {
      contentType: detected.mimeType,
      upsert: false,
    });

  if (uploadResult.error) {
    console.error("[saveLotteryCardImageUpload] Supabase storage upload error:", uploadResult.error);
    const storageError = uploadResult.error as { statusCode?: string; status?: number };
    const statusCode = storageError.statusCode ? parseInt(storageError.statusCode, 10) : (storageError.status ?? 500);
    if (statusCode === 413) {
      throw new LotteryCardImageUploadError("Fichier trop volumineux.", 413);
    }
    throw new LotteryCardImageUploadError(uploadResult.error.message, 500);
  }

  const { data } = supabase.storage.from(LOTTERY_CARD_IMAGE_BUCKET).getPublicUrl(fileName);
  if (!data?.publicUrl) {
    throw new LotteryCardImageUploadError("URL publique image indisponible.", 500);
  }

  return data.publicUrl;
}
