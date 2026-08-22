import type { MetadataRoute } from "next";
import { readPublishedCmsPagesByBackend } from "@/lib/cms-pages-backend";
import {
  getPublishedBlogPostsByBackend,
  readPublicStoreByBackend,
} from "@/lib/data-backend";
import { getSiteUrl } from "@/lib/site-url";
import { bretonCities } from "@/lib/local-seo-data";
import { mostRecentSeoDate, parseSeoDate } from "@/lib/seo-sitemap";

const categories = [
  "fleurs-cbd",
  "resines-cbd",
  "huiles-cbd",
  "e-liquide-cbd",
  "cosmetiques-cbd",
  "tisane-cbd",
  "miam-cbd",
  "accessoires-cbd",
];

const categorySlugs: Record<string, string> = {
  fleurs: "fleurs-cbd",
  resines: "resines-cbd",
  huiles: "huiles-cbd",
  "e-liquide": "e-liquide-cbd",
  cosmetiques: "cosmetiques-cbd",
  alimentaire: "tisane-cbd",
  miam: "miam-cbd",
  accessoires: "accessoires-cbd",
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();
  const [posts, cmsPages, store] = await Promise.all([
    getPublishedBlogPostsByBackend(),
    readPublishedCmsPagesByBackend(),
    readPublicStoreByBackend(),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/boutique`,
      lastModified: mostRecentSeoDate(
        store.products.map((product) => product.updatedAt ?? product.createdAt),
      ),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/cbd-naturel`,
      lastModified: new Date("2026-08-22T00:00:00.000Z"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/a-propos`,
      lastModified: new Date("2026-08-22T00:00:00.000Z"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/cbd-pas-cher`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: mostRecentSeoDate(posts.map((post) => post.updatedAt)),
      changeFrequency: "daily",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/fidelite`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/cgv`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/mentions-legales`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/politique-confidentialite`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/politique-cookies`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const categoryPages: MetadataRoute.Sitemap = categories.map((cat) => {
    const productCategory = Object.entries(categorySlugs).find(([, slug]) => slug === cat)?.[0];

    return {
      url: `${baseUrl}/boutique/${cat}`,
      lastModified: mostRecentSeoDate(
        store.products
          .filter((product) => product.category === productCategory)
          .map((product) => product.updatedAt ?? product.createdAt),
      ),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    };
  });

  const blogPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: parseSeoDate(post.updatedAt),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const cmsDynamicPages: MetadataRoute.Sitemap = cmsPages.map((page) => ({
    url: `${baseUrl}/${page.slug}`,
    lastModified: parseSeoDate(page.updatedAt),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const productPages: MetadataRoute.Sitemap = store.products
    .filter((product) => {
      const catSlug = categorySlugs[product.category];
      return !!catSlug;
    })
    .map((product) => ({
      url: `${baseUrl}/boutique/${categorySlugs[product.category]}/${product.id}`,
      lastModified: parseSeoDate(product.updatedAt ?? product.createdAt),
      changeFrequency: "weekly" as const,
      priority: 0.75,
    }));

  const localCityPages: MetadataRoute.Sitemap = bretonCities.map((city) => ({
    url: `${baseUrl}/${city.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.65,
  }));

  return [
    ...staticPages,
    ...categoryPages,
    ...productPages,
    ...blogPages,
    ...cmsDynamicPages,
    ...localCityPages,
  ];
}
