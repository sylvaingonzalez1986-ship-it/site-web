import "server-only";

import { randomUUID } from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/admin";
import { normalizeCmsSlug } from "@/lib/cms-pages-slugs";
import { TUTORIAL_CMS_SLUG_PREFIX } from "@/lib/tutorial-cms-pages";
import {
  CMS_PAGE_STATUS_VALUES,
  type CmsPage,
  type CmsPageCreateInput,
  type CmsPageSection,
  type CmsPageStatus,
  type CmsPageUpdateInput,
} from "@/types/cms-pages";
import { SECTION_STYLE_OPTIONS } from "@/types/store";

const validStatus = new Set<string>(CMS_PAGE_STATUS_VALUES);
const validStyles = new Set<string>(SECTION_STYLE_OPTIONS);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SECTIONS = 24;

function failIfError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`[supabase:${context}] ${error.message}`);
  }
}

function toObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function toText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toOptionalText(value: unknown): string | undefined {
  const text = toText(value).trim();
  return text.length > 0 ? text : undefined;
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function toIsoString(value: unknown): string {
  const text = toText(value);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) {
    return new Date().toISOString();
  }
  return new Date(parsed).toISOString();
}

function sanitizeStatus(value: unknown, fallback: CmsPageStatus): CmsPageStatus {
  const candidate = toText(value).trim().toLowerCase();
  if (validStatus.has(candidate)) {
    return candidate as CmsPageStatus;
  }

  return fallback;
}

function sanitizeSlug(value: unknown): string {
  const slug = normalizeCmsSlug(toText(value));
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error("Slug invalide. Utilise uniquement lettres, chiffres et tirets.");
  }

  return slug;
}

function sanitizeSections(value: unknown): CmsPageSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const sections: CmsPageSection[] = [];
  for (const rawSection of value.slice(0, MAX_SECTIONS)) {
    const section = toObject(rawSection);
    const id = sanitizeText(section.id, 64) || `section-${randomUUID().slice(0, 8)}`;
    const title = sanitizeText(section.title, 160);
    const body = sanitizeText(section.body, 16000);
    const styleCandidate = sanitizeText(section.style, 16);
    const style = validStyles.has(styleCandidate) ? styleCandidate : "cream";

    sections.push({
      id,
      title,
      body,
      style: style as CmsPageSection["style"],
    });
  }

  return sections;
}

function mapRowToCmsPage(row: Record<string, unknown>): CmsPage {
  return {
    id: toText(row.id),
    slug: sanitizeSlug(row.slug),
    title: sanitizeText(row.title, 160) || "Page sans titre",
    description: sanitizeText(row.description, 500),
    status: sanitizeStatus(row.status, "draft"),
    sections: sanitizeSections(row.sections),
    seoTitle: toOptionalText(row.seo_title),
    seoDescription: toOptionalText(row.seo_description),
    showInNav: row.show_in_nav === true,
    showInFooter: row.show_in_footer === true,
    navLabel: sanitizeText(row.nav_label, 80),
    footerLabel: sanitizeText(row.footer_label, 80),
    position: Math.max(0, Math.floor(toNumber(row.position, 0))),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function toInsertRow(input: CmsPageCreateInput): Record<string, unknown> {
  const slug = sanitizeSlug(input.slug);
  const title = sanitizeText(input.title, 160);
  if (!title) {
    throw new Error("Le titre est obligatoire.");
  }

  const now = new Date().toISOString();
  return {
    slug,
    title,
    description: sanitizeText(input.description, 500),
    status: sanitizeStatus(input.status, "draft"),
    sections: sanitizeSections(input.sections),
    seo_title: sanitizeText(input.seoTitle, 160) || null,
    seo_description: sanitizeText(input.seoDescription, 320) || null,
    show_in_nav: input.showInNav === true,
    show_in_footer: input.showInFooter === true,
    nav_label: sanitizeText(input.navLabel, 80),
    footer_label: sanitizeText(input.footerLabel, 80),
    position: Math.max(0, Math.floor(toNumber(input.position, 0))),
    created_at: now,
    updated_at: now,
  };
}

function toPatchRow(input: CmsPageUpdateInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof input.slug === "string") {
    patch.slug = sanitizeSlug(input.slug);
  }
  if (typeof input.title === "string") {
    const title = sanitizeText(input.title, 160);
    if (!title) {
      throw new Error("Le titre est obligatoire.");
    }
    patch.title = title;
  }
  if (typeof input.description === "string") {
    patch.description = sanitizeText(input.description, 500);
  }
  if (typeof input.status === "string") {
    patch.status = sanitizeStatus(input.status, "draft");
  }
  if (Array.isArray(input.sections)) {
    patch.sections = sanitizeSections(input.sections);
  }
  if (typeof input.seoTitle === "string") {
    patch.seo_title = sanitizeText(input.seoTitle, 160) || null;
  }
  if (typeof input.seoDescription === "string") {
    patch.seo_description = sanitizeText(input.seoDescription, 320) || null;
  }
  if (typeof input.showInNav === "boolean") {
    patch.show_in_nav = input.showInNav;
  }
  if (typeof input.showInFooter === "boolean") {
    patch.show_in_footer = input.showInFooter;
  }
  if (typeof input.navLabel === "string") {
    patch.nav_label = sanitizeText(input.navLabel, 80);
  }
  if (typeof input.footerLabel === "string") {
    patch.footer_label = sanitizeText(input.footerLabel, 80);
  }
  if (typeof input.position === "number") {
    patch.position = Math.max(0, Math.floor(toNumber(input.position, 0)));
  }

  return patch;
}

export async function readAdminCmsPagesFromSupabase(): Promise<CmsPage[]> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("cms_pages")
    .select("*")
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });
  failIfError(result.error, "read cms_pages admin");

  return (result.data ?? []).map((row) => mapRowToCmsPage(toObject(row)));
}

export async function readPublishedCmsPagesFromSupabase(): Promise<CmsPage[]> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("cms_pages")
    .select("*")
    .eq("status", "published")
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });
  failIfError(result.error, "read cms_pages published");

  return (result.data ?? []).map((row) => mapRowToCmsPage(toObject(row)));
}

export async function readTutorialCmsPagesFromSupabase(): Promise<CmsPage[]> {
  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("cms_pages")
    .select("*")
    .like("slug", `${TUTORIAL_CMS_SLUG_PREFIX}%`)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });
  failIfError(result.error, "read cms_pages tutorial");

  return (result.data ?? []).map((row) => mapRowToCmsPage(toObject(row)));
}

export async function getPublishedCmsPageBySlugFromSupabase(
  slug: string,
): Promise<CmsPage | null> {
  const safeSlug = normalizeCmsSlug(slug);
  if (!safeSlug || !SLUG_PATTERN.test(safeSlug)) {
    return null;
  }

  const supabase = createSupabaseServiceClient();
  const result = await supabase
    .from("cms_pages")
    .select("*")
    .eq("slug", safeSlug)
    .eq("status", "published")
    .maybeSingle();
  failIfError(result.error, "read cms_page by slug");

  if (!result.data) {
    return null;
  }

  return mapRowToCmsPage(toObject(result.data));
}

export async function createCmsPageInSupabase(input: CmsPageCreateInput): Promise<CmsPage> {
  const supabase = createSupabaseServiceClient();
  const row = toInsertRow(input);
  const result = await supabase
    .from("cms_pages")
    .insert(row)
    .select("*")
    .single();
  failIfError(result.error, "insert cms_page");

  return mapRowToCmsPage(toObject(result.data));
}

export async function updateCmsPageInSupabase(
  pageId: string,
  input: CmsPageUpdateInput,
): Promise<CmsPage | null> {
  const safeId = pageId.trim();
  if (!safeId) {
    return null;
  }

  const supabase = createSupabaseServiceClient();
  const patch = toPatchRow(input);
  const result = await supabase
    .from("cms_pages")
    .update(patch)
    .eq("id", safeId)
    .select("*")
    .maybeSingle();
  failIfError(result.error, "update cms_page");

  if (!result.data) {
    return null;
  }

  return mapRowToCmsPage(toObject(result.data));
}

export async function archiveCmsPageInSupabase(pageId: string): Promise<CmsPage | null> {
  return updateCmsPageInSupabase(pageId, {
    status: "archived",
    showInNav: false,
    showInFooter: false,
    navLabel: "",
    footerLabel: "",
  });
}
