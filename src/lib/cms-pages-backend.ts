import "server-only";

import { HOME_TUTORIAL_STEPS } from "@/data/tutorial-steps";
import {
  normalizeCmsSlug,
  isCmsSlugReserved,
  isCmsStaticOverrideSlug,
} from "@/lib/cms-pages-slugs";
import { isCmsPagesEnabledServer } from "@/lib/cms-pages-feature";
import {
  buildTutorialCmsPageSeedInputs,
  isTutorialCmsSlug,
} from "@/lib/tutorial-cms-pages";
import {
  archiveCmsPageInSupabase,
  createCmsPageInSupabase,
  getPublishedCmsPageBySlugFromSupabase,
  readAdminCmsPagesFromSupabase,
  readPublishedCmsPagesFromSupabase,
  updateCmsPageInSupabase,
} from "@/lib/supabase/cms-pages-backend";
import type { CmsPage, CmsPageCreateInput, CmsPageUpdateInput } from "@/types/cms-pages";

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

function isDuplicateSlugError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("duplicate key") ||
    message.includes("already exists") ||
    message.includes("unique constraint")
  );
}

async function ensureTutorialCmsPagesSeeded(existingPages: CmsPage[]): Promise<boolean> {
  const existingSlugs = new Set<string>(
    existingPages.map((page) => normalizeCmsSlug(page.slug)).filter(Boolean),
  );
  const tutorialSeeds = buildTutorialCmsPageSeedInputs(HOME_TUTORIAL_STEPS);
  let created = false;

  for (const seed of tutorialSeeds) {
    const normalizedSlug = normalizeCmsSlug(seed.slug);
    if (!normalizedSlug || existingSlugs.has(normalizedSlug)) {
      continue;
    }

    try {
      await createCmsPageInSupabase(seed);
      created = true;
      existingSlugs.add(normalizedSlug);
    } catch (error) {
      if (isDuplicateSlugError(error)) {
        existingSlugs.add(normalizedSlug);
        continue;
      }
      throw error;
    }
  }

  return created;
}

export async function readAdminCmsPagesByBackend(): Promise<CmsPage[]> {
  if (!isCmsPagesEnabledServer()) {
    return [];
  }

  const pages = await readAdminCmsPagesFromSupabase();
  const seeded = await ensureTutorialCmsPagesSeeded(pages);
  if (!seeded) {
    return pages;
  }

  return readAdminCmsPagesFromSupabase();
}

export async function readPublishedCmsPagesByBackend(): Promise<CmsPage[]> {
  if (!isCmsPagesEnabledServer()) {
    return [];
  }

  return readPublishedCmsPagesFromSupabase();
}

export async function readTutorialCmsPagesByBackend(): Promise<CmsPage[]> {
  if (!isCmsPagesEnabledServer()) {
    return [];
  }

  const adminPages = await readAdminCmsPagesFromSupabase();
  const seeded = await ensureTutorialCmsPagesSeeded(adminPages);
  const sourcePages = seeded ? await readAdminCmsPagesFromSupabase() : adminPages;
  const allowedTutorialSlugs = new Set(
    buildTutorialCmsPageSeedInputs(HOME_TUTORIAL_STEPS)
      .map((page) => normalizeCmsSlug(page.slug))
      .filter(Boolean),
  );

  return sourcePages.filter(
    (page) => isTutorialCmsSlug(page.slug) && allowedTutorialSlugs.has(normalizeCmsSlug(page.slug)),
  );
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
