export const CANONICAL_SITE_URL = "https://www.leschanvriersbretons.com";

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) {
    return CANONICAL_SITE_URL;
  }

  try {
    const parsed = new URL(raw);
    if (
      parsed.hostname === "leschanvriersbretons.com" ||
      parsed.hostname === "www.leschanvriersbretons.com"
    ) {
      return CANONICAL_SITE_URL;
    }

    return parsed.origin;
  } catch {
    return CANONICAL_SITE_URL;
  }
}

