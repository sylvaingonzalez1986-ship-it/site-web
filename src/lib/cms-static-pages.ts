import "server-only";

import { cache } from "react";
import type { Metadata } from "next";
import { getPublishedCmsPageBySlugByBackend } from "@/lib/cms-pages-backend";
import { getSiteUrl } from "@/lib/site-url";
import type { CmsPage } from "@/types/cms-pages";

export const LEGAL_STATIC_CMS_SLUGS = new Set<string>([
  "cgv",
  "mentions-legales",
  "politique-confidentialite",
  "politique-cookies",
  "reglement-jeu-promo",
]);

export const getStaticCmsPageBySlug = cache(async (slug: string): Promise<CmsPage | null> => {
  if (!LEGAL_STATIC_CMS_SLUGS.has(slug)) {
    return null;
  }

  return getPublishedCmsPageBySlugByBackend(slug, { allowReserved: true });
});

type BuildCmsStaticMetadataInput = {
  slug: string;
  canonicalPath: string;
  fallbackTitle: string;
  fallbackDescription: string;
};

export async function buildCmsStaticPageMetadata({
  slug,
  canonicalPath,
  fallbackTitle,
  fallbackDescription,
}: BuildCmsStaticMetadataInput): Promise<Metadata> {
  const page = await getStaticCmsPageBySlug(slug);
  const canonicalUrl = `${getSiteUrl()}${canonicalPath}`;

  if (!page) {
    return {
      title: fallbackTitle,
      description: fallbackDescription,
      alternates: { canonical: canonicalUrl },
    };
  }

  const title = page.seoTitle?.trim() || page.title;
  const description = page.seoDescription?.trim() || page.description;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "article",
    },
  };
}
