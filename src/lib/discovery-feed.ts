import type { Product } from "@/data/products";
import { PUBLIC_CATALOG_CATEGORIES } from "@/lib/catalog-categories";
import { dedupeProducts } from "@/lib/product-dedup";
import { mostRecentSeoDate, parseSeoDate } from "@/lib/seo-sitemap";
import type { BlogPost } from "@/types/store";

const WEB_SUB_HUB_URL = "https://pubsubhubbub.appspot.com/";
const EDITORIAL_PUBLISHED_AT = "2026-08-23T00:00:00.000Z";

type DiscoveryFeedEntry = {
  title: string;
  url: string;
  updated: string;
  summary: string;
  category: string;
};

type BuildDiscoveryFeedOptions = {
  baseUrl: string;
  products: Product[];
  posts: BlogPost[];
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function conciseSummary(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 320 ? `${normalized.slice(0, 317)}...` : normalized;
}

function entryXml(entry: DiscoveryFeedEntry): string {
  return [
    "  <entry>",
    `    <id>${escapeXml(entry.url)}</id>`,
    `    <title>${escapeXml(entry.title)}</title>`,
    `    <link rel="alternate" href="${escapeXml(entry.url)}" />`,
    `    <updated>${entry.updated}</updated>`,
    `    <category term="${escapeXml(entry.category)}" />`,
    `    <summary type="text">${escapeXml(conciseSummary(entry.summary))}</summary>`,
    "  </entry>",
  ].join("\n");
}

export function buildDiscoveryFeed({
  baseUrl,
  products,
  posts,
}: BuildDiscoveryFeedOptions): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const catalogUpdatedAt = mostRecentSeoDate(
    products.map((product) => product.updatedAt ?? product.createdAt),
  )?.toISOString();
  const pillarUpdatedAt = mostRecentSeoDate([
    EDITORIAL_PUBLISHED_AT,
    catalogUpdatedAt,
  ])!.toISOString();

  const editorialEntries: DiscoveryFeedEntry[] = [
    {
      title: "CBD naturel : origine, analyses et traçabilité",
      url: `${normalizedBaseUrl}/cbd-naturel`,
      updated: pillarUpdatedAt,
      summary:
        "Guide de référence, observatoire du catalogue et registre produit par produit pour vérifier l'origine, le producteur et les analyses disponibles.",
      category: "Guide CBD",
    },
    {
      title: "CBD breton : origine agricole et producteurs",
      url: `${normalizedBaseUrl}/cbd-breton`,
      updated: "2026-08-23T00:00:00.000Z",
      summary:
        "Méthode pour distinguer production bretonne, préparation en Bretagne et références de producteurs partenaires.",
      category: "Guide CBD",
    },
    {
      title: "Comment lire une analyse laboratoire CBD ?",
      url: `${normalizedBaseUrl}/analyse-laboratoire-cbd`,
      updated: "2026-08-22T00:00:00.000Z",
      summary:
        "Checklist pour vérifier le lot, le laboratoire, les cannabinoïdes, les unités, les limites de mesure et le périmètre d'un rapport.",
      category: "Guide CBD",
    },
    {
      title: "Glossaire CBD",
      url: `${normalizedBaseUrl}/glossaire-cbd`,
      updated: "2026-08-23T00:00:00.000Z",
      summary:
        "Définitions sourcées du CBD naturel, des cannabinoïdes, du spectre, des analyses et des principales notions réglementaires.",
      category: "Référence",
    },
  ];

  const blogEntries: DiscoveryFeedEntry[] = posts.flatMap((post) => {
    const updated = parseSeoDate(post.updatedAt ?? post.createdAt)?.toISOString();
    if (!updated) return [];

    return [{
      title: post.title,
      url: `${normalizedBaseUrl}/blog/${post.slug}`,
      updated,
      summary: post.excerpt,
      category: `Blog — ${post.category}`,
    }];
  });

  const categoryByCode = new Map(
    PUBLIC_CATALOG_CATEGORIES.map((category) => [category.category, category]),
  );
  const productEntries: DiscoveryFeedEntry[] = dedupeProducts(products).flatMap((product) => {
    const updated = parseSeoDate(product.updatedAt ?? product.createdAt)?.toISOString();
    const category = categoryByCode.get(product.category);
    if (!updated || !category) return [];

    return [{
      title: product.name,
      url: `${normalizedBaseUrl}/boutique/${category.slug}/${product.id}`,
      updated,
      summary: product.description,
      category: category.label,
    }];
  });

  const entries = [...editorialEntries, ...blogEntries, ...productEntries]
    .sort((left, right) => right.updated.localeCompare(left.updated) || left.title.localeCompare(right.title, "fr"));
  const feedUpdated = entries[0]?.updated ?? EDITORIAL_PUBLISHED_AT;
  const selfUrl = `${normalizedBaseUrl}/feed.xml`;

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <id>${escapeXml(`${normalizedBaseUrl}/`)}</id>`,
    "  <title>Les Chanvriers Bretons — guides et catalogue</title>",
    `  <updated>${feedUpdated}</updated>`,
    `  <link rel="self" type="application/atom+xml" href="${escapeXml(selfUrl)}" />`,
    `  <link rel="hub" href="${WEB_SUB_HUB_URL}" />`,
    `  <link rel="alternate" href="${escapeXml(normalizedBaseUrl)}" />`,
    "  <author><name>Les Chanvriers Bretons</name></author>",
    ...entries.map(entryXml),
    "</feed>",
    "",
  ].join("\n");
}
