import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import {
  BLOG_IMAGE_PUBLIC_UPLOAD_PREFIX,
  BLOG_IMAGE_UPLOAD_MAX_BYTES,
  isSupportedBlogImageMimeType,
} from "@/lib/blog-image-policy";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const BLOG_IMAGE_UPLOAD_DIR = path.join(
  PUBLIC_DIR,
  BLOG_IMAGE_PUBLIC_UPLOAD_PREFIX.replace(/^\//, ""),
);
const BLOG_IMAGE_FILE_EXTENSION_REGEX = /\.(jpg|jpeg|png|webp)$/i;
const BLOG_IMAGE_PATH_REGEX = /^\/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp)$/;
const BLOG_UPLOAD_FILE_NAME_REGEX = /^[a-f0-9-]{36}\.(jpg|jpeg|png|webp)$/;
const BLOG_IMAGE_BUCKET = "blog";
const DEFAULT_BLOG_IMAGE_PATH = "/product_flower.jpg";

type DetectedImageType = {
  extension: "jpg" | "png" | "webp";
  mimeType: "image/jpeg" | "image/png" | "image/webp";
};

export class BlogImageUploadError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "BlogImageUploadError";
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

  return BLOG_IMAGE_PATH_REGEX.test(imagePath);
}

function isSupportedRemoteImageUrl(imagePath: string): boolean {
  try {
    const url = new URL(imagePath);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return false;
    }

    return BLOG_IMAGE_FILE_EXTENSION_REGEX.test(url.pathname);
  } catch {
    return false;
  }
}

function isSupabaseStorageBackendEnabled(): boolean {
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

function isUploadBlogImagePath(imagePath: string): boolean {
  if (!imagePath.startsWith(BLOG_IMAGE_PUBLIC_UPLOAD_PREFIX)) {
    return false;
  }

  const fileName = imagePath.slice(BLOG_IMAGE_PUBLIC_UPLOAD_PREFIX.length);
  return BLOG_UPLOAD_FILE_NAME_REGEX.test(fileName);
}

export function normalizeBlogImagePath(imagePath: string | undefined): string {
  if (!imagePath) {
    return DEFAULT_BLOG_IMAGE_PATH;
  }

  if (isSupportedRemoteImageUrl(imagePath)) {
    return imagePath;
  }

  if (isSafePublicPath(imagePath)) {
    return imagePath;
  }

  return DEFAULT_BLOG_IMAGE_PATH;
}

export async function saveBlogImageUpload(file: File): Promise<string> {
  if (file.size <= 0) {
    throw new BlogImageUploadError("Fichier vide.", 400);
  }

  if (file.size > BLOG_IMAGE_UPLOAD_MAX_BYTES) {
    throw new BlogImageUploadError("Fichier trop volumineux.", 413);
  }

  const sanitizedMimeType = sanitizeMimeType(file.type);
  if (!isSupportedBlogImageMimeType(sanitizedMimeType)) {
    throw new BlogImageUploadError("Type de fichier non autorise.", 415);
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const detected = detectImageType(bytes);

  if (!detected) {
    throw new BlogImageUploadError("Format d'image invalide.", 415);
  }

  if (detected.mimeType !== sanitizedMimeType) {
    throw new BlogImageUploadError("Le contenu du fichier ne correspond pas au type déclaré.", 415);
  }

  const fileName = `${randomUUID()}.${detected.extension}`;

  if (isSupabaseStorageBackendEnabled()) {
    const supabase = createSupabaseServiceClient();
    const uploadResult = await supabase.storage
      .from(BLOG_IMAGE_BUCKET)
      .upload(fileName, Buffer.from(arrayBuffer), {
        contentType: detected.mimeType,
        upsert: false,
      });

    if (uploadResult.error) {
      throw new BlogImageUploadError(uploadResult.error.message, 500);
    }

    const { data } = supabase.storage.from(BLOG_IMAGE_BUCKET).getPublicUrl(fileName);
    if (!data?.publicUrl) {
      throw new BlogImageUploadError("URL publique image indisponible.", 500);
    }

    return data.publicUrl;
  }

  await mkdir(BLOG_IMAGE_UPLOAD_DIR, { recursive: true });

  const targetPath = path.join(BLOG_IMAGE_UPLOAD_DIR, fileName);
  await writeFile(targetPath, Buffer.from(arrayBuffer));

  return `${BLOG_IMAGE_PUBLIC_UPLOAD_PREFIX}${fileName}`;
}

export async function cleanupUnusedBlogUploads(imagePaths: string[]): Promise<void> {
  if (isSupabaseStorageBackendEnabled()) {
    const supabase = createSupabaseServiceClient();
    const referencedObjects = new Set(
      imagePaths
        .map((imagePath) => extractSupabaseObjectPath(imagePath, BLOG_IMAGE_BUCKET))
        .filter((value): value is string => Boolean(value)),
    );
    if (referencedObjects.size === 0) {
      // Safety guard: avoid deleting the whole bucket on an incomplete payload.
      return;
    }

    const removablePaths: string[] = [];
    let offset = 0;
    const pageSize = 100;

    while (true) {
      const listResult = await supabase.storage.from(BLOG_IMAGE_BUCKET).list("", {
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
        if (!name || !BLOG_UPLOAD_FILE_NAME_REGEX.test(name)) {
          continue;
        }
        if (!BLOG_IMAGE_FILE_EXTENSION_REGEX.test(name)) {
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
      await supabase.storage.from(BLOG_IMAGE_BUCKET).remove(removablePaths);
    }
    return;
  }

  await mkdir(BLOG_IMAGE_UPLOAD_DIR, { recursive: true });
  const referencedFiles = new Set(
    imagePaths
      .filter((imagePath) => isUploadBlogImagePath(imagePath))
      .map((imagePath) => imagePath.slice(BLOG_IMAGE_PUBLIC_UPLOAD_PREFIX.length)),
  );
  if (referencedFiles.size === 0) {
    // Safety guard: avoid deleting all local uploads on an incomplete payload.
    return;
  }

  const entries = await readdir(BLOG_IMAGE_UPLOAD_DIR, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isFile()) {
        return;
      }

      if (!BLOG_UPLOAD_FILE_NAME_REGEX.test(entry.name)) {
        return;
      }

      if (!BLOG_IMAGE_FILE_EXTENSION_REGEX.test(entry.name)) {
        return;
      }

      if (referencedFiles.has(entry.name)) {
        return;
      }

      await unlink(path.join(BLOG_IMAGE_UPLOAD_DIR, entry.name));
    }),
  );
}
