const PRODUCT_ANALYSIS_PATH_REGEX = /^\/[a-zA-Z0-9/_-]+\.pdf$/i;
const PRODUCT_VIDEO_PATH_REGEX = /^\/[a-zA-Z0-9/_-]+\.(mp4|mov)$/i;

function isSafePublicPath(value: string, pattern: RegExp): boolean {
  return value.startsWith("/")
    && !value.includes("\\")
    && !value.includes("..")
    && !value.includes("?")
    && !value.includes("#")
    && pattern.test(value);
}

function hasRemoteExtension(value: string, extensions: readonly string[]): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:")
      && extensions.some((extension) => url.pathname.toLowerCase().endsWith(extension));
  } catch {
    return false;
  }
}

export function normalizeProductAnalysisPath(filePath: string | undefined): string | undefined {
  if (!filePath) return undefined;
  return hasRemoteExtension(filePath, [".pdf"]) || isSafePublicPath(filePath, PRODUCT_ANALYSIS_PATH_REGEX)
    ? filePath
    : undefined;
}

export function normalizeProductVideoPath(videoPath: string | undefined): string | undefined {
  if (!videoPath) return undefined;
  return hasRemoteExtension(videoPath, [".mp4", ".mov"]) || isSafePublicPath(videoPath, PRODUCT_VIDEO_PATH_REGEX)
    ? videoPath
    : undefined;
}
