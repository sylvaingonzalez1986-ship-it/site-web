const RESERVED_SLUGS = [
  "admin",
  "age-gate",
  "api",
  "application",
  "blog",
  "boutique",
  "cgv",
  "compte",
  "fidelite",
  "jeu",
  "mentions-legales",
  "politique-confidentialite",
  "politique-cookies",
  "profil",
  "reglement-jeu-promo",
  "robots.txt",
  "sitemap.xml",
] as const;

const STATIC_OVERRIDE_SLUGS = [
  "cgv",
  "mentions-legales",
  "politique-confidentialite",
  "politique-cookies",
  "reglement-jeu-promo",
] as const;

export const RESERVED_CMS_SLUGS = new Set<string>(RESERVED_SLUGS);
export const CMS_STATIC_OVERRIDE_SLUGS = new Set<string>(STATIC_OVERRIDE_SLUGS);

export function normalizeCmsSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isCmsSlugReserved(slug: string): boolean {
  return RESERVED_CMS_SLUGS.has(normalizeCmsSlug(slug));
}

export function isCmsStaticOverrideSlug(slug: string): boolean {
  return CMS_STATIC_OVERRIDE_SLUGS.has(normalizeCmsSlug(slug));
}
