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

export function shouldUseNativeImg(value: string | undefined | null): boolean {
  if (!isRemoteImageUrl(value)) {
    return false;
  }

  try {
    const url = new URL(value ?? "");
    const isSupabaseHost = url.hostname === "supabase.co" || url.hostname.endsWith(".supabase.co");
    const isStorageObject = url.pathname.includes("/storage/v1/object/public/");

    return isSupabaseHost && isStorageObject;
  } catch {
    return false;
  }
}
