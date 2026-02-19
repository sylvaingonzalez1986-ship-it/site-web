import "server-only";

import {
  getBlogPostBySlugFromSupabase,
  getPublishedBlogPostsFromSupabase,
  readPublicStoreFromSupabase,
  readStoreFromSupabase,
  writeStoreToSupabase,
} from "@/lib/supabase/store-backend";
import type { BlogPost, CmsStore, PublicStoreResponse } from "@/types/store";

export async function readStoreByBackend(): Promise<CmsStore> {
  return readStoreFromSupabase();
}

export async function readPublicStoreByBackend(): Promise<PublicStoreResponse> {
  return readPublicStoreFromSupabase();
}

export async function writeStoreByBackend(nextStore: CmsStore): Promise<CmsStore> {
  return writeStoreToSupabase(nextStore);
}

export async function getPublishedBlogPostsByBackend(): Promise<BlogPost[]> {
  return getPublishedBlogPostsFromSupabase();
}

export async function getBlogPostBySlugByBackend(slug: string): Promise<BlogPost | null> {
  return getBlogPostBySlugFromSupabase(slug);
}
