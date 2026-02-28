const MAX_URL_LENGTH = 512;
const HAS_SCHEME_REGEX = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

export function normalizeExternalUrl(input: string | undefined): string {
  const raw = input?.trim();
  if (!raw) {
    return "";
  }

  if (raw.includes(" ")) {
    return "";
  }

  if (raw.startsWith("/") && !raw.startsWith("//")) {
    return "";
  }

  const candidate = raw.slice(0, MAX_URL_LENGTH);
  let url: URL;

  try {
    if (HAS_SCHEME_REGEX.test(candidate)) {
      url = new URL(candidate);
    } else if (candidate.startsWith("//")) {
      url = new URL(`https:${candidate}`);
    } else {
      url = new URL(`https://${candidate}`);
    }
  } catch {
    return "";
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "";
  }

  return url.href.slice(0, MAX_URL_LENGTH);
}
