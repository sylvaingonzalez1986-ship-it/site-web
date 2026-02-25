import { normalizeCmsSlug } from "@/lib/cms-pages-slugs";
import type { TutorialStep } from "@/data/tutorial-steps";
import type { CmsPage, CmsPageCreateInput } from "@/types/cms-pages";

export const TUTORIAL_CMS_SLUG_PREFIX = "tutorial-";
const TUTORIAL_POSITION_BASE = 9000;

function buildStepTitle(step: TutorialStep): string {
  return `Tutoriel - ${step.title}`;
}

function toStepSlug(stepId: string): string {
  const normalizedId = normalizeCmsSlug(stepId);
  const safeId = normalizedId || "etape";
  return `${TUTORIAL_CMS_SLUG_PREFIX}${safeId}`;
}

function buildStepDescription(step: TutorialStep): string {
  const text = step.text.trim();
  if (text.length > 0) {
    return text;
  }

  return `Contenu editable de l'etape ${step.id} du tutoriel interactif.`;
}

function toSectionBodyLines(body: string): string[] {
  return body
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function buildStepSections(step: TutorialStep) {
  const mainSection = {
    id: "main-text",
    title: "Texte principal",
    body: step.text,
    style: "cream" as const,
  };

  const details = (step.details ?? []).map((detail, index) => ({
    id: `detail-${index + 1}`,
    title: `Detail ${index + 1}`,
    body: detail,
    style: "mint" as const,
  }));

  if (details.length > 0) {
    return [mainSection, ...details];
  }

  return [mainSection];
}

export function isTutorialCmsSlug(slug: string): boolean {
  const normalized = normalizeCmsSlug(slug);
  return normalized.startsWith(TUTORIAL_CMS_SLUG_PREFIX);
}

export function tutorialStepIdToCmsSlug(stepId: string): string {
  return toStepSlug(stepId);
}

export function buildTutorialCmsPageSeedInputs(
  steps: TutorialStep[],
): CmsPageCreateInput[] {
  return steps.map((step, index) => ({
    slug: toStepSlug(step.id),
    title: buildStepTitle(step),
    description: buildStepDescription(step),
    status: "draft",
    sections: buildStepSections(step),
    seoTitle: "",
    seoDescription: "",
    showInNav: false,
    showInFooter: false,
    navLabel: "",
    footerLabel: "",
    position: TUTORIAL_POSITION_BASE + index,
  }));
}

export function applyTutorialCmsPageOverrides(
  steps: TutorialStep[],
  pages: CmsPage[],
): TutorialStep[] {
  if (steps.length === 0 || pages.length === 0) {
    return steps;
  }

  const pageBySlug = new Map<string, CmsPage>();
  for (const page of pages) {
    const normalizedSlug = normalizeCmsSlug(page.slug);
    if (normalizedSlug) {
      pageBySlug.set(normalizedSlug, page);
    }
  }

  return steps.map((step) => {
    const page = pageBySlug.get(toStepSlug(step.id));
    if (!page) {
      return step;
    }

    const title = page.title.trim() || step.title;
    const description = page.description.trim();
    const mainSection =
      page.sections.find((section) => section.id === "main-text") ?? page.sections[0];
    const mainLines = mainSection ? toSectionBodyLines(mainSection.body) : [];
    const detailLines = page.sections
      .filter((section) => section.id !== mainSection?.id)
      .flatMap((section) => toSectionBodyLines(section.body))
      .filter((line) => line.length > 0);
    const mainBodyRaw = mainSection?.body.trim() ?? "";
    const isMainBodyDefaultOrEmpty = mainBodyRaw.length === 0 || mainBodyRaw === step.text.trim();
    const text =
      description.length > 0 && isMainBodyDefaultOrEmpty
        ? description
        : mainLines[0] || description || step.text;

    const detailsFromPage = [...mainLines.slice(1), ...detailLines];
    const details =
      detailsFromPage.length > 0
        ? detailsFromPage
        : page.sections.length > 1
          ? []
          : step.details;

    return {
      ...step,
      title,
      text,
      details,
    };
  });
}
