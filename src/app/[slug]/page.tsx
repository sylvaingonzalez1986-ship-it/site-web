import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CmsPageRenderer } from "@/components/cms/CmsPageRenderer";
import { getPublishedCmsPageBySlugByBackend } from "@/lib/cms-pages-backend";
import { isCmsPagesEnabledServer } from "@/lib/cms-pages-feature";
import { isCmsSlugReserved } from "@/lib/cms-pages-slugs";
import { getSiteUrl } from "@/lib/site-url";

type CmsDynamicPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: CmsDynamicPageProps): Promise<Metadata> {
  const { slug } = await params;

  if (!isCmsPagesEnabledServer() || isCmsSlugReserved(slug)) {
    return {
      title: "Page introuvable",
      robots: { index: false, follow: false },
    };
  }

  const page = await getPublishedCmsPageBySlugByBackend(slug);
  if (!page) {
    return {
      title: "Page introuvable",
      robots: { index: false, follow: false },
    };
  }

  const baseUrl = getSiteUrl();
  const canonicalUrl = `${baseUrl}/${page.slug}`;
  const title = page.seoTitle?.trim() || page.title;
  const description = page.seoDescription?.trim() || page.description;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "article",
    },
  };
}

export default async function CmsDynamicPage({ params }: CmsDynamicPageProps) {
  const { slug } = await params;

  if (!isCmsPagesEnabledServer() || isCmsSlugReserved(slug)) {
    notFound();
  }

  const page = await getPublishedCmsPageBySlugByBackend(slug);
  if (!page) {
    notFound();
  }

  return <CmsPageRenderer page={page} />;
}
