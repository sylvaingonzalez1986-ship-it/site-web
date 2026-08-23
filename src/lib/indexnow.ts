import "server-only";

import type { Product, ProductCategory } from "@/data/products";
import { getSiteUrl } from "@/lib/site-url";
import type { BlogPost, CmsStore } from "@/types/store";

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const INDEXNOW_KEY_PATTERN = /^[A-Za-z0-9-]{8,128}$/;
const INDEXNOW_MAX_URLS = 10_000;

export const PRODUCT_CATEGORY_SLUGS: Record<ProductCategory, string> = {
  fleurs: "fleurs-cbd",
  resines: "resines-cbd",
  huiles: "huiles-cbd",
  "e-liquide": "e-liquide-cbd",
  cosmetiques: "cosmetiques-cbd",
  alimentaire: "tisane-cbd",
  miam: "miam-cbd",
  accessoires: "accessoires-cbd",
};

export function getIndexNowKey(): string | undefined {
  const key = process.env.INDEXNOW_KEY?.trim();
  return key && INDEXNOW_KEY_PATTERN.test(key) ? key : undefined;
}

export function getProductPublicPath(product: Pick<Product, "id" | "category">): string {
  return `/boutique/${PRODUCT_CATEGORY_SLUGS[product.category]}/${product.id}`;
}

function comparableProduct(product: Product): Omit<Product, "createdAt" | "updatedAt"> {
  return Object.fromEntries(
    Object.entries(product).filter(([key]) => !["createdAt", "updatedAt"].includes(key)),
  ) as Omit<Product, "createdAt" | "updatedAt">;
}

function comparableBlogPost(post: BlogPost): Omit<BlogPost, "createdAt" | "updatedAt"> {
  return Object.fromEntries(
    Object.entries(post).filter(([key]) => !["createdAt", "updatedAt"].includes(key)),
  ) as Omit<BlogPost, "createdAt" | "updatedAt">;
}

function differs(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) !== JSON.stringify(right);
}

function addProductUrls(paths: Set<string>, product: Product): void {
  paths.add(getProductPublicPath(product));
  paths.add(`/boutique/${PRODUCT_CATEGORY_SLUGS[product.category]}`);
}

export function collectChangedStorefrontPaths(
  previous: CmsStore,
  next: CmsStore,
): string[] {
  const paths = new Set<string>();
  const previousProducts = new Map(previous.products.map((product) => [product.id, product]));
  const nextProducts = new Map(next.products.map((product) => [product.id, product]));

  for (const productId of new Set([...previousProducts.keys(), ...nextProducts.keys()])) {
    const before = previousProducts.get(productId);
    const after = nextProducts.get(productId);
    if (
      before &&
      after &&
      !differs(comparableProduct(before), comparableProduct(after))
    ) {
      continue;
    }

    if (before) addProductUrls(paths, before);
    if (after) addProductUrls(paths, after);
    paths.add("/boutique");
  }

  const previousOrder = previous.products.map((product) => product.id);
  const nextOrder = next.products.map((product) => product.id);
  if (differs(previousOrder, nextOrder)) {
    paths.add("/boutique");
    for (const category of new Set(next.products.map((product) => product.category))) {
      paths.add(`/boutique/${PRODUCT_CATEGORY_SLUGS[category]}`);
    }
  }

  const previousPosts = new Map(previous.blog.map((post) => [post.id, post]));
  const nextPosts = new Map(next.blog.map((post) => [post.id, post]));
  for (const postId of new Set([...previousPosts.keys(), ...nextPosts.keys()])) {
    const before = previousPosts.get(postId);
    const after = nextPosts.get(postId);
    if (
      before &&
      after &&
      !differs(comparableBlogPost(before), comparableBlogPost(after))
    ) {
      continue;
    }

    if (before?.published) paths.add(`/blog/${before.slug}`);
    if (after?.published) paths.add(`/blog/${after.slug}`);
    paths.add("/blog");
  }

  if (
    differs(previous.content.home, next.content.home) ||
    differs(previous.sections.home, next.sections.home)
  ) {
    paths.add("/");
  }

  if (
    differs(previous.content.boutique, next.content.boutique) ||
    differs(previous.sections.boutique, next.sections.boutique) ||
    differs(previous.producers, next.producers)
  ) {
    paths.add("/boutique");
    paths.add("/cbd-naturel");
    paths.add("/cbd-breton");
    paths.add("/cbd-pas-cher");
    for (const product of next.products) addProductUrls(paths, product);
  }

  return [...paths].sort();
}

export function normalizeIndexNowUrls(paths: string[], baseUrl = getSiteUrl()): string[] {
  const origin = new URL(baseUrl).origin;
  const urls = new Set<string>();

  for (const path of paths) {
    try {
      const url = new URL(path, `${origin}/`);
      if (url.origin !== origin || !["http:", "https:"].includes(url.protocol)) {
        continue;
      }
      url.hash = "";
      urls.add(url.toString());
    } catch {
      // Ignore malformed URLs instead of making a CMS publication fail.
    }

    if (urls.size >= INDEXNOW_MAX_URLS) break;
  }

  return [...urls];
}

type NotifyIndexNowOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  key?: string;
};

export async function notifyIndexNow(
  paths: string[],
  options: NotifyIndexNowOptions = {},
): Promise<"notified" | "skipped" | "failed"> {
  const key = options.key ?? getIndexNowKey();
  if (!key || !INDEXNOW_KEY_PATTERN.test(key)) {
    return "skipped";
  }

  const baseUrl = options.baseUrl ?? getSiteUrl();
  const urls = normalizeIndexNowUrls(paths, baseUrl);
  if (urls.length === 0) {
    return "skipped";
  }

  const origin = new URL(baseUrl).origin;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4_000);

  try {
    const response = await (options.fetchImpl ?? fetch)(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: new URL(origin).host,
        key,
        keyLocation: `${origin}/indexnow-key.txt`,
        urlList: urls,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`IndexNow notification refused with status ${response.status}.`);
      return "failed";
    }

    return "notified";
  } catch (error) {
    console.warn("IndexNow notification failed.", error);
    return "failed";
  } finally {
    clearTimeout(timeoutId);
  }
}
