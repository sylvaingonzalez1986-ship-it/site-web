import "server-only";

import { mkdir, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { PRODUCT_ANALYSIS_PUBLIC_UPLOAD_PREFIX } from "@/lib/product-analysis-policy";
import { PRODUCT_VIDEO_PUBLIC_UPLOAD_PREFIX } from "@/lib/product-video-policy";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";

const PRODUCT_ANALYSIS_BUCKET = "product-analyses";
const PRODUCT_VIDEO_BUCKET = "product-videos";
const PRODUCT_ANALYSIS_FILE_REGEX = /^[a-f0-9-]{36}\.pdf$/i;
const PRODUCT_VIDEO_FILE_REGEX = /^[a-f0-9-]{36}\.(mp4|mov)$/i;

function extractSupabaseObjectPath(value: string, bucket: string): string | null {
  try {
    const url = new URL(value);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const markerIndex = url.pathname.indexOf(marker);
    return markerIndex === -1
      ? null
      : decodeURIComponent(url.pathname.slice(markerIndex + marker.length)) || null;
  } catch {
    return null;
  }
}

async function cleanupSupabaseBucket(
  bucket: string,
  referencedUrls: string[],
  allowedFileName: RegExp,
): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const referencedObjects = new Set(
    referencedUrls
      .map((value) => extractSupabaseObjectPath(value, bucket))
      .filter((value): value is string => Boolean(value)),
  );
  const removablePaths: string[] = [];
  const pageSize = 100;

  for (let offset = 0; ; offset += pageSize) {
    const result = await supabase.storage.from(bucket).list("", { limit: pageSize, offset });
    if (result.error) return;
    const entries = result.data ?? [];
    for (const entry of entries) {
      if (entry.name && allowedFileName.test(entry.name) && !referencedObjects.has(entry.name)) {
        removablePaths.push(entry.name);
      }
    }
    if (entries.length < pageSize) break;
  }

  if (removablePaths.length > 0) {
    await supabase.storage.from(bucket).remove(removablePaths);
  }
}

async function cleanupLocalDirectory(
  prefix: string,
  referencedPaths: string[],
  allowedFileName: RegExp,
): Promise<void> {
  const directory = path.join(process.cwd(), "public", prefix.replace(/^\//, ""));
  await mkdir(directory, { recursive: true });
  const referencedFiles = new Set(
    referencedPaths
      .filter((value) => value.startsWith(prefix))
      .map((value) => value.slice(prefix.length)),
  );
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(entries.map(async (entry) => {
    if (entry.isFile() && allowedFileName.test(entry.name) && !referencedFiles.has(entry.name)) {
      await unlink(path.join(directory, entry.name));
    }
  }));
}

export async function cleanupUnusedProductAnalyses(filePaths: string[]): Promise<void> {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    await cleanupSupabaseBucket(PRODUCT_ANALYSIS_BUCKET, filePaths, PRODUCT_ANALYSIS_FILE_REGEX);
    return;
  }
  await cleanupLocalDirectory(PRODUCT_ANALYSIS_PUBLIC_UPLOAD_PREFIX, filePaths, PRODUCT_ANALYSIS_FILE_REGEX);
}

export async function cleanupUnusedProductVideoUploads(videoPaths: string[]): Promise<void> {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    await cleanupSupabaseBucket(PRODUCT_VIDEO_BUCKET, videoPaths, PRODUCT_VIDEO_FILE_REGEX);
    return;
  }
  await cleanupLocalDirectory(PRODUCT_VIDEO_PUBLIC_UPLOAD_PREFIX, videoPaths, PRODUCT_VIDEO_FILE_REGEX);
}
