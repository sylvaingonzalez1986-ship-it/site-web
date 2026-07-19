import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";

import {
  isCmsSlugReserved,
  isCmsStaticOverrideSlug,
} from "@/lib/cms-pages-slugs";
import { isCmsPagesEnabledServer } from "@/lib/cms-pages-feature";
import {
  archiveCmsPageInSupabase,
  createCmsPageInSupabase,
  getPublishedCmsPageBySlugFromSupabase,
  readAdminCmsPagesFromSupabase,
  readPublishedCmsPagesFromSupabase,
  updateCmsPageInSupabase,
} from "@/lib/supabase/cms-pages-backend";
import type { CmsPage, CmsPageCreateInput, CmsPageUpdateInput } from "@/types/cms-pages";

export const CMS_PAGES_CACHE_TAG = "cms-pages";

const readPublishedCmsPagesCached = unstable_cache(
  async () => readPublishedCmsPagesFromSupabase(),
  ["read-published-cms-pages"],
  {
    revalidate: 60,
    tags: [CMS_PAGES_CACHE_TAG],
  },
);

function ensureCmsPagesEnabled(): void {
  if (!isCmsPagesEnabledServer()) {
    throw new Error("CMS pages disabled.");
  }
}

function assertSlugAllowedForCmsCrud(slug: string): void {
  if (isCmsSlugReserved(slug) && !isCmsStaticOverrideSlug(slug)) {
    throw new Error("Slug réservé. Choisis un autre slug.");
  }
}

type GetPublishedCmsPageOptions = {
  allowReserved?: boolean;
};

export async function readAdminCmsPagesByBackend(): Promise<CmsPage[]> {
  if (!isCmsPagesEnabledServer()) {
    return [];
  }

  return readAdminCmsPagesFromSupabase();
}

export async function readPublishedCmsPagesByBackend(): Promise<CmsPage[]> {
  if (!isCmsPagesEnabledServer()) {
    return [];
  }

  return readPublishedCmsPagesCached();
}

export async function getPublishedCmsPageBySlugByBackend(
  slug: string,
  options?: GetPublishedCmsPageOptions,
): Promise<CmsPage | null> {
  if (!isCmsPagesEnabledServer()) {
    return null;
  }
  if (!options?.allowReserved && isCmsSlugReserved(slug)) {
    return null;
  }

  return getPublishedCmsPageBySlugFromSupabase(slug);
}

export async function createCmsPageByBackend(input: CmsPageCreateInput): Promise<CmsPage> {
  ensureCmsPagesEnabled();
  assertSlugAllowedForCmsCrud(input.slug);
  return createCmsPageInSupabase(input);
}

export async function updateCmsPageByBackend(
  pageId: string,
  input: CmsPageUpdateInput,
): Promise<CmsPage | null> {
  ensureCmsPagesEnabled();
  if (typeof input.slug === "string") {
    assertSlugAllowedForCmsCrud(input.slug);
  }
  return updateCmsPageInSupabase(pageId, input);
}

export async function archiveCmsPageByBackend(pageId: string): Promise<CmsPage | null> {
  ensureCmsPagesEnabled();
  return archiveCmsPageInSupabase(pageId);
}

export function invalidateCmsPagesCache(): void {
  revalidateTag(CMS_PAGES_CACHE_TAG, "max");
}
