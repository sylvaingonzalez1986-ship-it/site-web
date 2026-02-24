export function sanitizeNextPath(
  value: string | null | undefined,
  fallback = "/",
): string {
  const safeFallback =
    typeof fallback === "string" && fallback.startsWith("/") && !fallback.startsWith("//")
      ? fallback
      : "/";

  if (typeof value !== "string") {
    return safeFallback;
  }

  let candidate = value.trim();
  if (!candidate) {
    return safeFallback;
  }

  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    return safeFallback;
  }

  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return safeFallback;
  }

  if (candidate.includes("\\") || /[\u0000-\u001f\u007f]/.test(candidate)) {
    return safeFallback;
  }

  return candidate;
}


