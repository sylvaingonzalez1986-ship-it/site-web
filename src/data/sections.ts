import type {
  ApplicationNativeSectionType,
  BlogPageNativeSectionType,
  BoutiqueNativeSectionType,
  HomeNativeSectionType,
  PageSections,
  SectionPageKey,
} from "@/types/store";

type NativeSectionDefinition<T extends string> = {
  id: string;
  type: T;
  label: string;
  icon: string;
};

export const HOME_SECTION_DEFINITIONS: NativeSectionDefinition<HomeNativeSectionType>[] = [
  { id: "home-hero", type: "hero", label: "Hero", icon: "🏠" },
  { id: "home-legal", type: "legal", label: "Legal", icon: "⚖️" },
  { id: "home-products", type: "products", label: "Produits", icon: "📦" },
  { id: "home-app", type: "app", label: "App", icon: "📱" },
  { id: "home-story", type: "story", label: "Histoire", icon: "📖" },
  { id: "home-contact", type: "contact", label: "Contact", icon: "✉️" },
];

export const BOUTIQUE_SECTION_DEFINITIONS: NativeSectionDefinition<BoutiqueNativeSectionType>[] = [
  { id: "boutique-header", type: "header", label: "Header", icon: "🧭" },
  { id: "boutique-products", type: "products", label: "Produits", icon: "🛍️" },
  { id: "boutique-copains", type: "copains", label: "Coin des Copains", icon: "🤝" },
];

export const APPLICATION_SECTION_DEFINITIONS: NativeSectionDefinition<ApplicationNativeSectionType>[] = [
  { id: "application-hero", type: "hero", label: "Hero", icon: "📱" },
  { id: "application-features", type: "features", label: "Features", icon: "✨" },
  { id: "application-newsletter", type: "newsletter", label: "Newsletter", icon: "📬" },
];

export const BLOG_SECTION_DEFINITIONS: NativeSectionDefinition<BlogPageNativeSectionType>[] = [
  { id: "blog-header", type: "header", label: "Header", icon: "📰" },
  { id: "blog-posts", type: "posts", label: "Articles", icon: "📝" },
];

export const NATIVE_SECTION_DEFINITIONS = {
  home: HOME_SECTION_DEFINITIONS,
  boutique: BOUTIQUE_SECTION_DEFINITIONS,
  application: APPLICATION_SECTION_DEFINITIONS,
  blog: BLOG_SECTION_DEFINITIONS,
} as const;

export function createDefaultPageSections(): PageSections {
  return {
    home: HOME_SECTION_DEFINITIONS.map((section) => ({
      id: section.id,
      type: section.type,
      visible: true,
    })),
    boutique: BOUTIQUE_SECTION_DEFINITIONS.map((section) => ({
      id: section.id,
      type: section.type,
      visible: true,
    })),
    application: APPLICATION_SECTION_DEFINITIONS.map((section) => ({
      id: section.id,
      type: section.type,
      visible: true,
    })),
    blog: BLOG_SECTION_DEFINITIONS.map((section) => ({
      id: section.id,
      type: section.type,
      visible: true,
    })),
  };
}

export function getNativeSectionLabel(
  page: SectionPageKey,
  type: string,
): string {
  const definition = NATIVE_SECTION_DEFINITIONS[page].find(
    (section) => section.type === type,
  );
  return definition?.label ?? type;
}

export function getNativeSectionIcon(page: SectionPageKey, type: string): string {
  const definition = NATIVE_SECTION_DEFINITIONS[page].find(
    (section) => section.type === type,
  );
  return definition?.icon ?? "🧩";
}
