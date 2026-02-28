import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import {
  PRODUCT_IMAGE_PUBLIC_UPLOAD_PREFIX,
  PRODUCT_IMAGE_UPLOAD_MAX_BYTES,
  isSupportedProductImageMimeType,
} from "@/lib/product-image-policy";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const PRODUCT_IMAGE_UPLOAD_DIR = path.join(
  PUBLIC_DIR,
  PRODUCT_IMAGE_PUBLIC_UPLOAD_PREFIX.replace(/^\//, ""),
);
const PRODUCT_IMAGE_FILE_EXTENSION_REGEX = /\.(jpg|jpeg|png|webp)$/i;
const PRODUCT_IMAGE_PATH_REGEX = /^\/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp)$/;
const PRODUCT_UPLOAD_FILE_NAME_REGEX = /^[a-f0-9-]{36}\.(jpg|jpeg|png|webp)$/;
const PRODUCT_IMAGE_BUCKET = "products";
export const DEFAULT_PRODUCT_IMAGE_PATH = "/product_flower.jpg";

type DetectedImageType = {
  extension: "jpg" | "png" | "webp";
  mimeType: "image/jpeg" | "image/png" | "image/webp";
};

export class ProductImageUploadError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ProductImageUploadError";
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

function isSafePublicPath(imagePath: string): boolean {
  if (!imagePath.startsWith("/")) {
    return false;
  }

  if (imagePath.includes("\\") || imagePath.includes("..")) {
    return false;
  }

  if (imagePath.includes("?") || imagePath.includes("#")) {
    return false;
  }

  return PRODUCT_IMAGE_PATH_REGEX.test(imagePath);
}

function isSupportedRemoteImageUrl(imagePath: string): boolean {
  try {
    const url = new URL(imagePath);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return false;
    }

    return PRODUCT_IMAGE_FILE_EXTENSION_REGEX.test(url.pathname);
  } catch {
    return false;
  }
}

function useSupabaseStorageBackend(): boolean {
  return true;
}

function extractSupabaseObjectPath(imagePath: string, bucket: string): string | null {
  try {
    const url = new URL(imagePath);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) {
      return null;
    }

    const objectPath = decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
    return objectPath || null;
  } catch {
    return null;
  }
}

function isUploadProductImagePath(imagePath: string): boolean {
  if (!imagePath.startsWith(PRODUCT_IMAGE_PUBLIC_UPLOAD_PREFIX)) {
    return false;
  }

  const fileName = imagePath.slice(PRODUCT_IMAGE_PUBLIC_UPLOAD_PREFIX.length);
  return PRODUCT_UPLOAD_FILE_NAME_REGEX.test(fileName);
}

export function normalizeProductImagePath(imagePath: string | undefined): string {
  if (!imagePath) {
    return DEFAULT_PRODUCT_IMAGE_PATH;
  }

  if (isSupportedRemoteImageUrl(imagePath)) {
    return imagePath;
  }

  if (isSafePublicPath(imagePath)) {
    return imagePath;
  }

  return DEFAULT_PRODUCT_IMAGE_PATH;
}

export async function saveProductImageUpload(file: File): Promise<string> {
  if (file.size <= 0) {
    throw new ProductImageUploadError("Fichier vide.", 400);
  }

  if (file.size > PRODUCT_IMAGE_UPLOAD_MAX_BYTES) {
    throw new ProductImageUploadError("Fichier trop volumineux.", 413);
  }

  const sanitizedMimeType = sanitizeMimeType(file.type);
  if (!isSupportedProductImageMimeType(sanitizedMimeType)) {
    throw new ProductImageUploadError("Type de fichier non autorise.", 415);
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const detected = detectImageType(bytes);

  if (!detected) {
    throw new ProductImageUploadError("Format d'image invalide.", 415);
  }

  if (detected.mimeType !== sanitizedMimeType) {
    throw new ProductImageUploadError("Le contenu du fichier ne correspond pas au type déclaré.", 415);
  }

  const fileName = `${randomUUID()}.${detected.extension}`;

  if (useSupabaseStorageBackend()) {
    const supabase = createSupabaseServiceClient();
    const uploadResult = await supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .upload(fileName, Buffer.from(arrayBuffer), {
        contentType: detected.mimeType,
        upsert: false,
      });

    if (uploadResult.error) {
      throw new ProductImageUploadError(uploadResult.error.message, 500);
    }

    const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(fileName);
    if (!data?.publicUrl) {
      throw new ProductImageUploadError("URL publique image indisponible.", 500);
    }

    return data.publicUrl;
  }

  await mkdir(PRODUCT_IMAGE_UPLOAD_DIR, { recursive: true });
  const targetPath = path.join(PRODUCT_IMAGE_UPLOAD_DIR, fileName);
  await writeFile(targetPath, Buffer.from(arrayBuffer));

  return `${PRODUCT_IMAGE_PUBLIC_UPLOAD_PREFIX}${fileName}`;
}

export async function cleanupUnusedProductUploads(imagePaths: string[]): Promise<void> {
  if (useSupabaseStorageBackend()) {
    const supabase = createSupabaseServiceClient();
    const referencedObjects = new Set(
      imagePaths
        .map((imagePath) => extractSupabaseObjectPath(imagePath, PRODUCT_IMAGE_BUCKET))
        .filter((value): value is string => Boolean(value)),
    );

    const removablePaths: string[] = [];
    let offset = 0;
    const pageSize = 100;

    while (true) {
      const listResult = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).list("", {
        limit: pageSize,
        offset,
      });
      if (listResult.error) {
        break;
      }

      const entries = listResult.data ?? [];
      if (entries.length === 0) {
        break;
      }

      for (const entry of entries) {
        const name = entry.name;
        if (!name || !PRODUCT_UPLOAD_FILE_NAME_REGEX.test(name)) {
          continue;
        }
        if (!PRODUCT_IMAGE_FILE_EXTENSION_REGEX.test(name)) {
          continue;
        }
        if (referencedObjects.has(name)) {
          continue;
        }
        removablePaths.push(name);
      }

      if (entries.length < pageSize) {
        break;
      }
      offset += pageSize;
    }

    if (removablePaths.length > 0) {
      await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove(removablePaths);
    }
    return;
  }

  await mkdir(PRODUCT_IMAGE_UPLOAD_DIR, { recursive: true });
  const referencedFiles = new Set(
    imagePaths
      .filter((imagePath) => isUploadProductImagePath(imagePath))
      .map((imagePath) => imagePath.slice(PRODUCT_IMAGE_PUBLIC_UPLOAD_PREFIX.length)),
  );

  const entries = await readdir(PRODUCT_IMAGE_UPLOAD_DIR, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isFile()) {
        return;
      }

      if (!PRODUCT_UPLOAD_FILE_NAME_REGEX.test(entry.name)) {
        return;
      }

      if (!PRODUCT_IMAGE_FILE_EXTENSION_REGEX.test(entry.name)) {
        return;
      }

      if (referencedFiles.has(entry.name)) {
        return;
      }

      await unlink(path.join(PRODUCT_IMAGE_UPLOAD_DIR, entry.name));
    }),
  );
}
