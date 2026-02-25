import type { MetadataRoute } from "next";
import { readPublishedCmsPagesByBackend } from "@/lib/cms-pages-backend";
import { getPublishedBlogPostsByBackend } from "@/lib/data-backend";
import { getSiteUrl } from "@/lib/site-url";

const categories = [
  "fleurs-cbd",
  "resines-cbd",
  "huiles-cbd",
  "e-liquide-cbd",
  "cosmetiques-cbd",
  "tisane-cbd",
  "accessoires-cbd",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();
  const [posts, cmsPages] = await Promise.all([
    getPublishedBlogPostsByBackend(),
    readPublishedCmsPagesByBackend(),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/boutique`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/application`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/fidelite`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];

  const categoryPages: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${baseUrl}/boutique/${cat}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const blogPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const cmsDynamicPages: MetadataRoute.Sitemap = cmsPages.map((page) => ({
    url: `${baseUrl}/${page.slug}`,
    lastModified: new Date(page.updatedAt),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...categoryPages, ...blogPages, ...cmsDynamicPages];
}
