export const CANONICAL_SITE_URL = "https://leschanvriersbretons.com";

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) {
    return CANONICAL_SITE_URL;
  }

  try {
    return new URL(raw).origin;
  } catch {
    return CANONICAL_SITE_URL;
  }
}

