import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ProductAnalysisRedactionError,
  sanitizeProductAnalysisPdf,
} from "@/lib/product-analysis-redaction";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import {
  PRODUCT_ANALYSIS_PUBLIC_UPLOAD_PREFIX,
  PRODUCT_ANALYSIS_UPLOAD_MAX_BYTES,
  isSupportedProductAnalysisMimeType,
} from "@/lib/product-analysis-policy";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const PRODUCT_ANALYSIS_UPLOAD_DIR = path.join(
  PUBLIC_DIR,
  PRODUCT_ANALYSIS_PUBLIC_UPLOAD_PREFIX.replace(/^\//, ""),
);
const PRODUCT_ANALYSIS_FILE_EXTENSION_REGEX = /\.pdf$/i;
const PRODUCT_ANALYSIS_PATH_REGEX = /^\/[a-zA-Z0-9/_-]+\.pdf$/;
const PRODUCT_ANALYSIS_UPLOAD_FILE_NAME_REGEX = /^[a-f0-9-]{36}\.pdf$/;
const PRODUCT_ANALYSIS_BUCKET = "product-analyses";

type DetectedPdfType = {
  extension: "pdf";
  mimeType: "application/pdf";
};

export class ProductAnalysisUploadError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ProductAnalysisUploadError";
  }
}

function sanitizeMimeType(mimeType: string): string {
  return mimeType.trim().toLowerCase();
}

function detectPdfType(bytes: Uint8Array): DetectedPdfType | null {
  if (bytes.length < 5) {
    return null;
  }

  const isPdf =
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d; // -

  return isPdf ? { extension: "pdf", mimeType: "application/pdf" } : null;
}

function isSafePublicPath(filePath: string): boolean {
  if (!filePath.startsWith("/")) {
    return false;
  }

  if (filePath.includes("\\") || filePath.includes("..")) {
    return false;
  }

  if (filePath.includes("?") || filePath.includes("#")) {
    return false;
  }

  return PRODUCT_ANALYSIS_PATH_REGEX.test(filePath);
}

function isSupportedRemotePdfUrl(filePath: string): boolean {
  try {
    const url = new URL(filePath);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return false;
    }

    return PRODUCT_ANALYSIS_FILE_EXTENSION_REGEX.test(url.pathname);
  } catch {
    return false;
  }
}

function isSupabaseStorageBackendEnabled(): boolean {
  return true;
}

function extractSupabaseObjectPath(filePath: string, bucket: string): string | null {
  try {
    const url = new URL(filePath);
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

function isUploadProductAnalysisPath(filePath: string): boolean {
  if (!filePath.startsWith(PRODUCT_ANALYSIS_PUBLIC_UPLOAD_PREFIX)) {
    return false;
  }

  const fileName = filePath.slice(PRODUCT_ANALYSIS_PUBLIC_UPLOAD_PREFIX.length);
  return PRODUCT_ANALYSIS_UPLOAD_FILE_NAME_REGEX.test(fileName);
}

export function normalizeProductAnalysisPath(filePath: string | undefined): string | undefined {
  if (!filePath) {
    return undefined;
  }

  if (isSupportedRemotePdfUrl(filePath)) {
    return filePath;
  }

  if (isSafePublicPath(filePath)) {
    return filePath;
  }

  return undefined;
}

export async function saveProductAnalysisUpload(file: File): Promise<string> {
  if (file.size <= 0) {
    throw new ProductAnalysisUploadError("Fichier vide.", 400);
  }

  if (file.size > PRODUCT_ANALYSIS_UPLOAD_MAX_BYTES) {
    throw new ProductAnalysisUploadError("Fichier trop volumineux.", 413);
  }

  const sanitizedMimeType = sanitizeMimeType(file.type);
  if (
    sanitizedMimeType &&
    !isSupportedProductAnalysisMimeType(sanitizedMimeType)
  ) {
    throw new ProductAnalysisUploadError("Type de fichier non autorise.", 415);
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const detected = detectPdfType(bytes);

  if (!detected) {
    throw new ProductAnalysisUploadError("Le fichier n'est pas un PDF valide.", 415);
  }

  if (
    sanitizedMimeType &&
    sanitizedMimeType !== detected.mimeType &&
    sanitizedMimeType !== "application/x-pdf"
  ) {
    throw new ProductAnalysisUploadError(
      "Le contenu du fichier ne correspond pas au type déclaré.",
      415,
    );
  }

  let uploadBytes = Buffer.from(arrayBuffer);

  try {
    const sanitized = await sanitizeProductAnalysisPdf(bytes);
    uploadBytes = Buffer.from(sanitized.bytes);
  } catch (error) {
    if (error instanceof ProductAnalysisRedactionError) {
      throw new ProductAnalysisUploadError(error.message, 422);
    }

    throw error;
  }

  const fileName = `${randomUUID()}.${detected.extension}`;

  if (isSupabaseStorageBackendEnabled()) {
    const supabase = createSupabaseServiceClient();
    const uploadResult = await supabase.storage
      .from(PRODUCT_ANALYSIS_BUCKET)
      .upload(fileName, uploadBytes, {
        contentType: detected.mimeType,
        upsert: false,
      });

    if (uploadResult.error) {
      throw new ProductAnalysisUploadError(uploadResult.error.message, 500);
    }

    const { data } = supabase.storage
      .from(PRODUCT_ANALYSIS_BUCKET)
      .getPublicUrl(fileName);

    if (!data?.publicUrl) {
      throw new ProductAnalysisUploadError("URL publique PDF indisponible.", 500);
    }

    return data.publicUrl;
  }

  await mkdir(PRODUCT_ANALYSIS_UPLOAD_DIR, { recursive: true });
  const targetPath = path.join(PRODUCT_ANALYSIS_UPLOAD_DIR, fileName);
  await writeFile(targetPath, uploadBytes);

  return `${PRODUCT_ANALYSIS_PUBLIC_UPLOAD_PREFIX}${fileName}`;
}

export async function cleanupUnusedProductAnalyses(filePaths: string[]): Promise<void> {
  if (isSupabaseStorageBackendEnabled()) {
    const supabase = createSupabaseServiceClient();
    const referencedObjects = new Set(
      filePaths
        .map((filePath) => extractSupabaseObjectPath(filePath, PRODUCT_ANALYSIS_BUCKET))
        .filter((value): value is string => Boolean(value)),
    );

    const removablePaths: string[] = [];
    let offset = 0;
    const pageSize = 100;

    while (true) {
      const listResult = await supabase.storage.from(PRODUCT_ANALYSIS_BUCKET).list("", {
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
        if (!name || !PRODUCT_ANALYSIS_UPLOAD_FILE_NAME_REGEX.test(name)) {
          continue;
        }

        if (!PRODUCT_ANALYSIS_FILE_EXTENSION_REGEX.test(name)) {
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
      await supabase.storage.from(PRODUCT_ANALYSIS_BUCKET).remove(removablePaths);
    }

    return;
  }

  await mkdir(PRODUCT_ANALYSIS_UPLOAD_DIR, { recursive: true });
  const referencedFiles = new Set(
    filePaths
      .filter((filePath) => isUploadProductAnalysisPath(filePath))
      .map((filePath) => filePath.slice(PRODUCT_ANALYSIS_PUBLIC_UPLOAD_PREFIX.length)),
  );

  const entries = await readdir(PRODUCT_ANALYSIS_UPLOAD_DIR, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isFile()) {
        return;
      }

      if (!PRODUCT_ANALYSIS_UPLOAD_FILE_NAME_REGEX.test(entry.name)) {
        return;
      }

      if (!PRODUCT_ANALYSIS_FILE_EXTENSION_REGEX.test(entry.name)) {
        return;
      }

      if (referencedFiles.has(entry.name)) {
        return;
      }

      await unlink(path.join(PRODUCT_ANALYSIS_UPLOAD_DIR, entry.name));
    }),
  );
}

