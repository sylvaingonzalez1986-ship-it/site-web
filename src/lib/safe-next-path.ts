// Only root-relative destinations are returned, so this origin need not depend
// on request headers and is identical in server and client components.
const VALIDATION_ORIGIN = "https://next-path.invalid";
const MAX_DECODE_PASSES = 5;

function validatedNextPath(value: unknown, requiredPrefix?: string): string | null {
  if (typeof value !== "string" || value !== value.trim()) return null;

  let candidate = value;
  for (let pass = 0; pass < MAX_DECODE_PASSES; pass += 1) {
    if (
      !candidate.startsWith("/") ||
      candidate.startsWith("//") ||
      candidate.includes("\\") ||
      /[\u0000-\u001f\u007f]/.test(candidate)
    ) return null;

    const pathname = candidate.split(/[?#]/, 1)[0];
    // Refuse paths whose meaning can change after routing or URL normalization.
    // Encoded separators are not needed here: searchParams already decoded the
    // enclosing `next` parameter. Query values keep their original encoding.
    if (
      pathname.includes("//") ||
      /(?:^|\/)\.{1,2}(?:\/|$)/.test(pathname) ||
      /%(?:2f|3f|23)/i.test(pathname)
    ) return null;

    try {
      const destination = new URL(candidate, VALIDATION_ORIGIN);
      if (
        destination.origin !== VALIDATION_ORIGIN ||
        (requiredPrefix && destination.pathname !== requiredPrefix &&
          !destination.pathname.startsWith(`${requiredPrefix}/`))
      ) return null;

      // Inspect nested encoding without changing query/fragment semantics in
      // the returned URL. A literal percent decoded from %25 is valid data.
      const encoded = pass === 0 ? candidate : candidate.replace(/%(?![\da-f]{2})/gi, "%25");
      const decoded = decodeURIComponent(encoded);
      if (decoded === candidate) return value;
      candidate = decoded;
    } catch {
      return null;
    }
  }

  // Reject excessively nested encoding instead of trusting an uninspected layer.
  return null;
}

export function sanitizeNextPath(value: unknown, fallback = "/"): string {
  return validatedNextPath(value) ?? validatedNextPath(fallback) ?? "/";
}

export function sanitizeAdminNextPath(value: unknown): string {
  return validatedNextPath(value, "/admin") ?? "/admin";
}


