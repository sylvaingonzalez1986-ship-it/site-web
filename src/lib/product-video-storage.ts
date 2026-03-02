import "server-only";

import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readdir, readFile, rm, stat, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import {
  PRODUCT_VIDEO_PUBLIC_UPLOAD_PREFIX,
  PRODUCT_VIDEO_UPLOAD_MAX_BYTES,
  isSupportedProductVideoMimeType,
} from "@/lib/product-video-policy";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const PRODUCT_VIDEO_UPLOAD_DIR = path.join(
  PUBLIC_DIR,
  PRODUCT_VIDEO_PUBLIC_UPLOAD_PREFIX.replace(/^\//, ""),
);
const PRODUCT_VIDEO_PATH_REGEX = /^\/[a-zA-Z0-9/_-]+\.(mp4|mov)$/i;
const PRODUCT_VIDEO_BUCKET = "product-videos";
const PRODUCT_VIDEO_FILE_NAME_REGEX = /^[a-f0-9-]{36}\.(mp4|mov)$/i;
const BOOMERANG_SEGMENT_SECONDS = 1.5;
const PRODUCT_VIDEO_MAX_DIMENSION = 720;
const PRODUCT_VIDEO_OUTPUT_FPS = 24;
const PRODUCT_VIDEO_OUTPUT_CRF = 30;

export class ProductVideoUploadError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ProductVideoUploadError";
  }
}

function isSafePublicPath(videoPath: string): boolean {
  if (!videoPath.startsWith("/")) {
    return false;
  }

  if (videoPath.includes("\\") || videoPath.includes("..")) {
    return false;
  }

  if (videoPath.includes("?") || videoPath.includes("#")) {
    return false;
  }

  return PRODUCT_VIDEO_PATH_REGEX.test(videoPath);
}

function isSupportedRemoteVideoUrl(videoPath: string): boolean {
  try {
    const url = new URL(videoPath);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return false;
    }
    const pathname = url.pathname.toLowerCase();
    return pathname.endsWith(".mp4") || pathname.endsWith(".mov");
  } catch {
    return false;
  }
}

function shouldUseSupabaseStorageBackend(): boolean {
  return true;
}

function extractSupabaseObjectPath(videoPath: string, bucket: string): string | null {
  try {
    const url = new URL(videoPath);
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

function isUploadProductVideoPath(videoPath: string): boolean {
  if (!videoPath.startsWith(PRODUCT_VIDEO_PUBLIC_UPLOAD_PREFIX)) {
    return false;
  }

  const fileName = videoPath.slice(PRODUCT_VIDEO_PUBLIC_UPLOAD_PREFIX.length);
  return PRODUCT_VIDEO_FILE_NAME_REGEX.test(fileName);
}

async function runFfmpeg(args: string[]): Promise<void> {
  const binaryPath = ffmpegPath;
  if (!binaryPath) {
    throw new ProductVideoUploadError("ffmpeg indisponible.", 503);
  }

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(binaryPath, args, { windowsHide: true });
    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    proc.on("error", (error) => reject(error));
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr || "Conversion video echouee."));
    });
  });
}

async function hasUsableFfmpegBinary(): Promise<boolean> {
  if (!ffmpegPath) {
    return false;
  }

  try {
    await access(ffmpegPath);
    return true;
  } catch {
    return false;
  }
}

export function normalizeProductVideoPath(videoPath: string | undefined): string | undefined {
  if (!videoPath) {
    return undefined;
  }

  if (isSupportedRemoteVideoUrl(videoPath)) {
    return videoPath;
  }

  if (isSafePublicPath(videoPath)) {
    return videoPath;
  }

  return undefined;
}

export async function saveProductVideoUpload(file: File): Promise<string> {
  if (file.size <= 0) {
    throw new ProductVideoUploadError("Fichier vide.", 400);
  }

  if (file.size > PRODUCT_VIDEO_UPLOAD_MAX_BYTES) {
    throw new ProductVideoUploadError("Fichier trop volumineux.", 413);
  }

  if (!isSupportedProductVideoMimeType(file.type)) {
    throw new ProductVideoUploadError("Type de fichier non autorise.", 415);
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "product-video-"));
  const inputPath =
    file.type === "video/quicktime"
      ? path.join(tempDir, "input.mov")
      : path.join(tempDir, "input.mp4");
  let outputContentType = "video/mp4";
  let outputName = `${randomUUID()}.mp4`;
  const outputPath = path.join(tempDir, "output.mp4");

  try {
    let outputBuffer: Buffer | null = null;
    if (await hasUsableFfmpegBinary()) {
      await writeFile(inputPath, inputBuffer);

      const filter = [
        `[0:v]trim=0:${BOOMERANG_SEGMENT_SECONDS},setpts=PTS-STARTPTS[v0]`,
        `[v0]reverse,setpts=PTS-STARTPTS[v1]`,
        `[v0][v1]concat=n=2:v=1:a=0,fps=${PRODUCT_VIDEO_OUTPUT_FPS},scale='min(${PRODUCT_VIDEO_MAX_DIMENSION},iw)':-2:flags=lanczos,format=yuv420p[v]`,
      ].join(";");

      try {
        await runFfmpeg([
          "-y",
          "-i",
          inputPath,
          "-filter_complex",
          filter,
          "-map",
          "[v]",
          "-an",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          String(PRODUCT_VIDEO_OUTPUT_CRF),
          "-pix_fmt",
          "yuv420p",
          "-movflags",
          "+faststart",
          outputPath,
        ]);
      } catch (error) {
        const spawnError = error as NodeJS.ErrnoException;
        if (spawnError?.code === "ENOENT" && file.type === "video/mp4") {
          outputBuffer = inputBuffer;
        } else if (spawnError?.code === "ENOENT" && file.type === "video/quicktime") {
          outputContentType = "video/quicktime";
          outputName = `${randomUUID()}.mov`;
          outputBuffer = inputBuffer;
        } else if (spawnError?.code === "ENOENT") {
          throw new ProductVideoUploadError(
            "Conversion video indisponible sur le serveur pour ce format.",
            503,
          );
        } else {
          throw error;
        }
      }

      if (outputBuffer) {
        // Fallback direct for MP4 when ffmpeg exists in deps but cannot spawn at runtime.
      } else {
        const outputStats = await stat(outputPath);
        if (outputStats.size > PRODUCT_VIDEO_UPLOAD_MAX_BYTES) {
          throw new ProductVideoUploadError("Video convertie trop volumineuse.", 413);
        }

        outputBuffer = await readFile(outputPath);
      }
    } else if (file.type === "video/mp4") {
      outputBuffer = inputBuffer;
    } else if (file.type === "video/quicktime") {
      outputContentType = "video/quicktime";
      outputName = `${randomUUID()}.mov`;
      outputBuffer = inputBuffer;
    } else {
      throw new ProductVideoUploadError(
        "Conversion video indisponible sur le serveur pour ce format.",
        503,
      );
    }

    if (!outputBuffer) {
      throw new ProductVideoUploadError("Conversion video echouee.", 500);
    }

    if (shouldUseSupabaseStorageBackend()) {
      const supabase = createSupabaseServiceClient();
      const uploadResult = await supabase.storage
        .from(PRODUCT_VIDEO_BUCKET)
        .upload(outputName, outputBuffer, {
          contentType: outputContentType,
          upsert: false,
        });

      if (uploadResult.error) {
        throw new ProductVideoUploadError(uploadResult.error.message, 500);
      }

      const { data } = supabase.storage.from(PRODUCT_VIDEO_BUCKET).getPublicUrl(outputName);
      if (!data?.publicUrl) {
        throw new ProductVideoUploadError("URL publique video indisponible.", 500);
      }

      return data.publicUrl;
    }

    await mkdir(PRODUCT_VIDEO_UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(PRODUCT_VIDEO_UPLOAD_DIR, outputName), outputBuffer);
    return `${PRODUCT_VIDEO_PUBLIC_UPLOAD_PREFIX}${outputName}`;
  } catch (error) {
    if (error instanceof ProductVideoUploadError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Conversion video echouee.";
    throw new ProductVideoUploadError(message, 500);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function cleanupUnusedProductVideoUploads(videoPaths: string[]): Promise<void> {
  if (shouldUseSupabaseStorageBackend()) {
    const supabase = createSupabaseServiceClient();
    const referencedObjects = new Set(
      videoPaths
        .map((videoPath) => extractSupabaseObjectPath(videoPath, PRODUCT_VIDEO_BUCKET))
        .filter((value): value is string => Boolean(value)),
    );

    const removablePaths: string[] = [];
    let offset = 0;
    const pageSize = 100;

    while (true) {
      const listResult = await supabase.storage.from(PRODUCT_VIDEO_BUCKET).list("", {
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
        if (!name || !PRODUCT_VIDEO_FILE_NAME_REGEX.test(name)) {
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
      await supabase.storage.from(PRODUCT_VIDEO_BUCKET).remove(removablePaths);
    }
    return;
  }

  await mkdir(PRODUCT_VIDEO_UPLOAD_DIR, { recursive: true });
  const referencedFiles = new Set(
    videoPaths
      .filter((videoPath) => isUploadProductVideoPath(videoPath))
      .map((videoPath) => videoPath.slice(PRODUCT_VIDEO_PUBLIC_UPLOAD_PREFIX.length)),
  );

  const entries = await readdir(PRODUCT_VIDEO_UPLOAD_DIR, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isFile()) {
        return;
      }

      if (!PRODUCT_VIDEO_FILE_NAME_REGEX.test(entry.name)) {
        return;
      }

      if (referencedFiles.has(entry.name)) {
        return;
      }

      await unlink(path.join(PRODUCT_VIDEO_UPLOAD_DIR, entry.name));
    }),
  );
}
