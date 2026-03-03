import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";

import {
  getBlogPostBySlugFromSupabase,
  getPublishedBlogPostsFromSupabase,
  readPublicStoreFromSupabase,
  readStoreFromSupabase,
  writeStoreToSupabase,
} from "@/lib/supabase/store-backend";
import type { BlogPost, CmsStore, PublicStoreResponse } from "@/types/store";

export const PUBLIC_STORE_CACHE_TAG = "public-store";
export const BLOG_POSTS_CACHE_TAG = "blog-posts";

const readPublicStoreCached = unstable_cache(
  async () => readPublicStoreFromSupabase(),
  ["read-public-store"],
  {
    revalidate: 60,
    tags: [PUBLIC_STORE_CACHE_TAG],
  },
);

const getPublishedBlogPostsCached = unstable_cache(
  async () => getPublishedBlogPostsFromSupabase(),
  ["get-published-blog-posts"],
  {
    revalidate: 300,
    tags: [BLOG_POSTS_CACHE_TAG],
  },
);

const getBlogPostBySlugCached = unstable_cache(
  async (slug: string) => getBlogPostBySlugFromSupabase(slug),
  ["get-blog-post-by-slug"],
  {
    revalidate: 300,
    tags: [BLOG_POSTS_CACHE_TAG],
  },
);

export async function readStoreByBackend(): Promise<CmsStore> {
  return readStoreFromSupabase();
}

export async function readPublicStoreByBackend(): Promise<PublicStoreResponse> {
  return readPublicStoreCached();
}

export async function writeStoreByBackend(nextStore: CmsStore): Promise<CmsStore> {
  return writeStoreToSupabase(nextStore);
}

export async function getPublishedBlogPostsByBackend(): Promise<BlogPost[]> {
  return getPublishedBlogPostsCached();
}

export async function getBlogPostBySlugByBackend(slug: string): Promise<BlogPost | null> {
  return getBlogPostBySlugCached(slug);
}

export function invalidatePublicStoreCache(): void {
  revalidateTag(PUBLIC_STORE_CACHE_TAG, "max");
}

export function invalidateBlogPostsCache(): void {
  revalidateTag(BLOG_POSTS_CACHE_TAG, "max");
}
