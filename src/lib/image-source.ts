export function isRemoteImageUrl(value: string | undefined | null): boolean {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function isLocalImagePath(value: string | undefined | null): boolean {
  if (!value) {
    return false;
  }

  return value.startsWith("/");
}

export function isRenderableImageSource(value: string | undefined | null): boolean {
  return isRemoteImageUrl(value) || isLocalImagePath(value);
}

/**
 * All remote images come from domains configured in next.config.ts remotePatterns
 * (Supabase, Wixstatic, Printful CDN), so Next.js Image handles them natively.
 */
export function shouldUseNativeImg(): boolean {
  return false;
}
