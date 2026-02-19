"use client";

import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Home,
  LayoutGrid,
  Plus,
  ShoppingBag,
  Smartphone,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type Dispatch, type KeyboardEvent, type SetStateAction } from "react";
import { getNativeSectionIcon, getNativeSectionLabel } from "@/data/sections";
import {
  SECTION_STYLE_OPTIONS,
  type CmsStore,
  type PageSections,
  type SectionPageKey,
  type SectionStyle,
} from "@/types/store";

type AdminTextCarouselProps = {
  draft: CmsStore;
  setDraft: Dispatch<SetStateAction<CmsStore>>;
};

type SlideKey = "home" | "boutique" | "application" | "blog" | "footer";
type SlideDefinition = { key: SlideKey; label: string; icon: LucideIcon; sectionPage?: SectionPageKey };
type CustomDraft = { title: string; body: string; style: SectionStyle };
type TextField = {
  path: string;
  label: string;
  placeholder: string;
  type: "input" | "textarea";
  minHeightClass?: string;
};

const SLIDES: SlideDefinition[] = [
  { key: "home", label: "Accueil", icon: Home, sectionPage: "home" },
  { key: "boutique", label: "Boutique", icon: ShoppingBag, sectionPage: "boutique" },
  { key: "application", label: "Application", icon: Smartphone, sectionPage: "application" },
  { key: "blog", label: "Blog", icon: BookOpen, sectionPage: "blog" },
  { key: "footer", label: "Footer", icon: LayoutGrid },
];

const STYLE_LABELS: Record<SectionStyle, string> = { mint: "Mint", yellow: "Yellow", cream: "Cream" };

const NATIVE_TEXT_FIELDS: Record<SectionPageKey, Record<string, TextField[]>> = {
  home: {
    hero: [
      { path: "home.heroEyebrow", label: "Hero Eyebrow", placeholder: "Hero tag", type: "input" },
      { path: "home.heroLine1", label: "Hero Ligne 1", placeholder: "Hero ligne 1", type: "input" },
      { path: "home.heroLine2", label: "Hero Ligne 2", placeholder: "Hero ligne 2", type: "input" },
      { path: "home.heroLine3", label: "Hero Ligne 3", placeholder: "Hero ligne 3", type: "input" },
      { path: "home.heroDescription", label: "Hero Description", placeholder: "Description hero", type: "textarea" },
      { path: "home.heroPrimaryCtaLabel", label: "Bouton Principal Hero", placeholder: "Voir la boutique", type: "input" },
      { path: "home.heroSecondaryCtaLabel", label: "Bouton Secondaire Hero", placeholder: "Lire notre histoire", type: "input" },
    ],
    legal: [
      { path: "home.legalLine1", label: "Legal Ligne 1", placeholder: "Legal ligne 1", type: "input" },
      { path: "home.legalLine2", label: "Legal Ligne 2", placeholder: "Legal ligne 2", type: "input" },
      { path: "home.legalDescription", label: "Legal Description", placeholder: "Description legal", type: "textarea" },
      { path: "home.legalPillThc", label: "Pill THC", placeholder: "THC moins de 0.3%", type: "input" },
      { path: "home.legalPillLab", label: "Pill Labo", placeholder: "Analyses labo", type: "input" },
      { path: "home.legalPillDelivery", label: "Pill Livraison", placeholder: "Livraison suivie", type: "input" },
    ],
    products: [
      { path: "home.productsTitleLine1", label: "Titre Produits Ligne 1", placeholder: "NOS", type: "input" },
      { path: "home.productsTitleLine2", label: "Titre Produits Ligne 2", placeholder: "PRODUITS", type: "input" },
      { path: "home.productsPricePrefix", label: "Prefixe Prix", placeholder: "A partir de", type: "input" },
      { path: "home.productsAddButtonLabel", label: "Label Bouton Ajouter", placeholder: "Ajouter", type: "input" },
      { path: "home.productsCtaLabel", label: "Label CTA Produits", placeholder: "Voir toute la boutique", type: "input" },
    ],
    app: [
      { path: "home.appTitleLine1", label: "Titre App Ligne 1", placeholder: "LES", type: "input" },
      { path: "home.appTitleLine2", label: "Titre App Ligne 2", placeholder: "CHANVRIERS", type: "input" },
      { path: "home.appTitleLine3", label: "Titre App Ligne 3", placeholder: "UNIS", type: "input" },
      { path: "home.appDescription", label: "Description App", placeholder: "Description app section accueil", type: "textarea" },
      { path: "home.appStoreLabel", label: "Label App Store", placeholder: "App Store", type: "input" },
      { path: "home.playStoreLabel", label: "Label Google Play", placeholder: "Google Play", type: "input" },
      { path: "home.appProducerTitle", label: "Titre Bloc Producteurs", placeholder: "Pour les producteurs", type: "input" },
      { path: "home.appProducerDescription", label: "Description Bloc Producteurs", placeholder: "Rejoignez le reseau des chanvriers bretons", type: "textarea", minHeightClass: "min-h-20" },
    ],
    story: [
      { path: "home.storyTitle", label: "Titre Histoire", placeholder: "Titre histoire", type: "input" },
      { path: "home.storyDescription", label: "Description Histoire", placeholder: "Description histoire", type: "textarea" },
    ],
    contact: [
      { path: "home.contactTitle", label: "Titre Contact", placeholder: "Titre contact", type: "input" },
      { path: "home.contactDescription", label: "Description Contact", placeholder: "Description contact", type: "textarea" },
      { path: "home.contactNamePlaceholder", label: "Placeholder Nom", placeholder: "Nom", type: "input" },
      { path: "home.contactEmailPlaceholder", label: "Placeholder Email", placeholder: "Email", type: "input" },
      { path: "home.contactSubmitLabel", label: "Label Bouton Contact", placeholder: "Envoyer", type: "input" },
    ],
  },
  boutique: {
    header: [
      { path: "boutique.eyebrow", label: "Eyebrow", placeholder: "Boutique eyebrow", type: "input" },
      { path: "boutique.title", label: "Titre", placeholder: "Boutique titre", type: "input" },
      { path: "boutique.description", label: "Description", placeholder: "Boutique description", type: "textarea" },
    ],
    products: [
      { path: "boutique.emptyMessage", label: "Message Liste Vide", placeholder: "Message liste vide", type: "textarea", minHeightClass: "min-h-20" },
      { path: "boutique.addButtonLabel", label: "Label Bouton Ajouter", placeholder: "Ajouter", type: "input" },
    ],
    copains: [
      { path: "boutique.copainsSectionTitle", label: "Titre Section Copains", placeholder: "Titre section copains", type: "input" },
      { path: "boutique.copainsSectionDescription", label: "Description Section Copains", placeholder: "Description section copains", type: "textarea", minHeightClass: "min-h-20" },
      { path: "boutique.producerPartnerLabel", label: "Label Badge Producteur", placeholder: "Producteur Partenaire", type: "input" },
      { path: "boutique.producerWebsiteLabel", label: "Label Lien Site Producteur", placeholder: "Voir le site", type: "input" },
    ],
  },
  application: {
    hero: [
      { path: "application.eyebrow", label: "Eyebrow", placeholder: "App eyebrow", type: "input" },
      { path: "application.title", label: "Titre", placeholder: "App titre", type: "input" },
      { path: "application.description", label: "Description", placeholder: "App description", type: "textarea", minHeightClass: "min-h-20" },
      { path: "application.heroPrimaryButtonLabel", label: "Label Bouton Principal", placeholder: "App Store - Bientot", type: "input" },
      { path: "application.heroSecondaryButtonLabel", label: "Label Bouton Secondaire", placeholder: "Google Play - Bientot", type: "input" },
    ],
    features: [
      { path: "application.feature1Title", label: "Feature 1 Titre", placeholder: "Fidelite", type: "input" },
      { path: "application.feature1Description", label: "Feature 1 Description", placeholder: "Description feature 1", type: "textarea", minHeightClass: "min-h-20" },
      { path: "application.feature2Title", label: "Feature 2 Titre", placeholder: "Commande rapide", type: "input" },
      { path: "application.feature2Description", label: "Feature 2 Description", placeholder: "Description feature 2", type: "textarea", minHeightClass: "min-h-20" },
      { path: "application.feature3Title", label: "Feature 3 Titre", placeholder: "Communaute", type: "input" },
      { path: "application.feature3Description", label: "Feature 3 Description", placeholder: "Description feature 3", type: "textarea", minHeightClass: "min-h-20" },
      { path: "application.feature4Title", label: "Feature 4 Titre", placeholder: "Actus locales", type: "input" },
      { path: "application.feature4Description", label: "Feature 4 Description", placeholder: "Description feature 4", type: "textarea", minHeightClass: "min-h-20" },
    ],
    newsletter: [
      { path: "application.newsletterTitle", label: "Titre Newsletter", placeholder: "Titre newsletter", type: "input" },
      { path: "application.newsletterDescription", label: "Description Newsletter", placeholder: "Description newsletter", type: "textarea", minHeightClass: "min-h-20" },
      { path: "application.newsletterEmailPlaceholder", label: "Placeholder Email", placeholder: "Ton e-mail", type: "input" },
      { path: "application.newsletterSubmitLabel", label: "Label Bouton Newsletter", placeholder: "Me prevenir", type: "input" },
    ],
  },
  blog: {
    header: [
      { path: "blog.eyebrow", label: "Eyebrow Blog", placeholder: "Blog", type: "input" },
      { path: "blog.title", label: "Titre Blog", placeholder: "Blog titre", type: "input" },
      { path: "blog.description", label: "Description Blog", placeholder: "Blog description", type: "textarea", minHeightClass: "min-h-20" },
      { path: "blog.breadcrumbHomeLabel", label: "Breadcrumb Accueil", placeholder: "Accueil", type: "input" },
      { path: "blog.breadcrumbBlogLabel", label: "Breadcrumb Blog", placeholder: "Blog", type: "input" },
    ],
    posts: [
      { path: "blog.postsEmptyMessage", label: "Message Aucune Publication", placeholder: "Aucun article publie pour le moment.", type: "textarea", minHeightClass: "min-h-20" },
      { path: "blog.postsReadMoreLabel", label: "Label Lire l'article", placeholder: "Lire l'article", type: "input" },
      { path: "blog.postPublishedPrefix", label: "Prefixe Date Publication", placeholder: "Publie le", type: "input" },
      { path: "blog.postBackLabel", label: "Label Retour Blog", placeholder: "Retour au blog", type: "input" },
    ],
  },
};

const FOOTER_FIELDS: TextField[] = [
  { path: "footer.copyright", label: "Copyright", placeholder: "Copyright", type: "input" },
  { path: "footer.legalLabel", label: "Label Mentions Legales", placeholder: "Label mentions", type: "input" },
  { path: "footer.privacyLabel", label: "Label Confidentialite", placeholder: "Label confidentialite", type: "input" },
];

function createDefaultCustomDraft(): CustomDraft {
  return { title: "Nouvelle section", body: "Ajoute ton texte ici.", style: "cream" };
}

function createCustomSectionId(page: SectionPageKey): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${page}-custom-${crypto.randomUUID().slice(0, 8)}`;
  }

  return `${page}-custom-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

function TextFieldControl({
  field,
  value,
  onChange,
  active,
}: {
  field: TextField;
  value: string;
  onChange: (value: string) => void;
  active: boolean;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wider text-charcoal">{field.label}</span>
      {field.type === "textarea" ? (
        <textarea
          className={`${field.minHeightClass ?? "min-h-24"} w-full border-2 border-[#1a1a1a] bg-white p-3`}
          placeholder={field.placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={!active}
        />
      ) : (
        <input
          className="h-11 border-2 border-[#1a1a1a] bg-white px-3"
          placeholder={field.placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={!active}
        />
      )}
    </label>
  );
}

export function AdminTextCarousel({ draft, setDraft }: AdminTextCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedSectionIds, setSelectedSectionIds] = useState<Partial<Record<SectionPageKey, string>>>({});
  const [addingCustomByPage, setAddingCustomByPage] = useState<Record<SectionPageKey, boolean>>({ home: false, boutique: false, application: false, blog: false });
  const [customDraftByPage, setCustomDraftByPage] = useState<Record<SectionPageKey, CustomDraft>>({
    home: createDefaultCustomDraft(),
    boutique: createDefaultCustomDraft(),
    application: createDefaultCustomDraft(),
    blog: createDefaultCustomDraft(),
  });

  const totalSlides = SLIDES.length;
  const activeSlide = useMemo(() => SLIDES[currentSlide] ?? SLIDES[0], [currentSlide]);

  const readContentValue = (path: string): string => {
    const [group, key] = path.split(".") as [keyof CmsStore["content"], string];
    const groupContent = draft.content[group] as Record<string, string>;
    return groupContent[key] ?? "";
  };

  const writeContentValue = (path: string, value: string) => {
    const [group, key] = path.split(".") as [keyof CmsStore["content"], string];
    setDraft((current) => ({
      ...current,
      content: {
        ...current.content,
        [group]: {
          ...(current.content[group] as object),
          [key]: value,
        },
      },
    }));
  };
  const updateSections = <K extends SectionPageKey>(page: K, updater: (sections: PageSections[K]) => PageSections[K]) => {
    setDraft((current) => ({
      ...current,
      sections: {
        ...current.sections,
        [page]: updater(current.sections[page]),
      },
    }));
  };

  const getSelectedSectionId = (page: SectionPageKey): string | null => {
    const sections = draft.sections[page];
    if (sections.length === 0) {
      return null;
    }

    const selected = selectedSectionIds[page];
    if (selected && sections.some((section) => section.id === selected)) {
      return selected;
    }

    return sections[0].id;
  };

  const moveSection = (page: SectionPageKey, fromIndex: number, direction: "up" | "down") => {
    updateSections(page, (sections) => {
      const nextIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
      if (nextIndex < 0 || nextIndex >= sections.length) {
        return sections;
      }

      const next = [...sections];
      [next[fromIndex], next[nextIndex]] = [next[nextIndex], next[fromIndex]];
      return next as PageSections[typeof page];
    });
  };

  const toggleSectionVisibility = (page: SectionPageKey, sectionId: string) => {
    updateSections(page, (sections) =>
      sections.map((section) =>
        section.id === sectionId ? { ...section, visible: !section.visible } : section,
      ) as PageSections[typeof page],
    );
  };

  const addCustomSection = (page: SectionPageKey) => {
    const customDraft = customDraftByPage[page];
    const id = createCustomSectionId(page);

    updateSections(page, (sections) =>
      [
        ...sections,
        {
          id,
          type: "custom",
          visible: true,
          custom: {
            title: customDraft.title.trim() || "Nouvelle section",
            body: customDraft.body.trim(),
            style: customDraft.style,
          },
        },
      ] as PageSections[typeof page],
    );

    setSelectedSectionIds((current) => ({ ...current, [page]: id }));
    setAddingCustomByPage((current) => ({ ...current, [page]: false }));
    setCustomDraftByPage((current) => ({ ...current, [page]: createDefaultCustomDraft() }));
  };

  const removeCustomSection = (page: SectionPageKey, sectionId: string) => {
    updateSections(page, (sections) => {
      const target = sections.find((section) => section.id === sectionId);
      if (!target || target.type !== "custom") {
        return sections;
      }

      return sections.filter((section) => section.id !== sectionId) as PageSections[typeof page];
    });

    setSelectedSectionIds((current) =>
      current[page] === sectionId ? { ...current, [page]: undefined } : current,
    );
  };

  const updateCustomSection = (page: SectionPageKey, sectionId: string, field: keyof CustomDraft, value: string) => {
    updateSections(page, (sections) =>
      sections.map((section) => {
        if (section.id !== sectionId || section.type !== "custom") {
          return section;
        }

        if (field === "style" && !SECTION_STYLE_OPTIONS.includes(value as SectionStyle)) {
          return section;
        }

        return {
          ...section,
          custom: {
            ...section.custom,
            [field]: value,
          },
        };
      }) as PageSections[typeof page],
    );
  };

  const updateCustomDraft = (page: SectionPageKey, field: keyof CustomDraft, value: string) => {
    setCustomDraftByPage((current) => {
      if (field === "style" && !SECTION_STYLE_OPTIONS.includes(value as SectionStyle)) {
        return current;
      }

      return {
        ...current,
        [page]: {
          ...current[page],
          [field]: value,
        },
      };
    });
  };

  const goToSlide = (nextSlide: number) => {
    setCurrentSlide(Math.max(0, Math.min(totalSlides - 1, nextSlide)));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    const tagName = target?.tagName;
    if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goToSlide(currentSlide - 1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      goToSlide(currentSlide + 1);
    }
  };

  const renderNativeEditor = (page: SectionPageKey, type: string, active: boolean) => {
    const fields = NATIVE_TEXT_FIELDS[page][type] ?? [];
    if (fields.length === 0) {
      return (
        <p className="text-sm text-charcoal">
          Cette section ne contient pas de champs textes CMS dedies.
        </p>
      );
    }

    return (
      <div className="grid gap-3">
        {fields.map((field) => (
          <TextFieldControl
            key={`${page}-${type}-${field.path}`}
            field={field}
            value={readContentValue(field.path)}
            onChange={(value) => writeContentValue(field.path, value)}
            active={active}
          />
        ))}
      </div>
    );
  };

  const renderSectionManager = (page: SectionPageKey, active: boolean) => {
    const sections = draft.sections[page];
    const publicOrderLabel = sections
      .filter((section) => section.visible)
      .map((section) =>
        section.type === "custom"
          ? section.custom.title || "Section custom"
          : getNativeSectionLabel(page, section.type),
      )
      .join(" -> ");
    const selectedSectionId = getSelectedSectionId(page);
    const selectedSection = selectedSectionId
      ? sections.find((section) => section.id === selectedSectionId) ?? null
      : null;

    return (
      <div className="grid gap-4">
        <section className="admin-field-group">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-2xl text-ink">Sections de la page</h3>
            <button
              type="button"
              className="btn-cartoon btn-secondary inline-flex items-center gap-2 px-3 py-2 text-xs"
              onClick={() =>
                setAddingCustomByPage((current) => ({ ...current, [page]: !current[page] }))
              }
              disabled={!active}
            >
              <Plus size={14} /> Ajouter une section
            </button>
          </div>

          <div className="mt-3 grid gap-2">
            {sections.map((section, index) => {
              const isCustom = section.type === "custom";
              const isSelected = section.id === selectedSectionId;
              const label = isCustom
                ? section.custom.title || "Section custom"
                : getNativeSectionLabel(page, section.type);

              return (
                <article
                  key={section.id}
                  className={`cartoon-border-sm bg-white p-2 ${isSelected ? "ring-2 ring-orange" : ""}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() => setSelectedSectionIds((current) => ({ ...current, [page]: section.id }))}
                      disabled={!active}
                    >
                      <span className="text-lg">{isCustom ? "🧩" : getNativeSectionIcon(page, section.type)}</span>
                      <span className="truncate text-sm font-semibold text-ink">{label}</span>
                      {!section.visible && <span className="pill-cartoon px-2 py-0.5 text-[10px]">Masquee</span>}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="btn-cartoon btn-secondary h-8 w-8 p-0"
                        onClick={() => moveSection(page, index, "up")}
                        disabled={!active || index === 0}
                        aria-label="Monter"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn-cartoon btn-secondary h-8 w-8 p-0"
                        onClick={() => moveSection(page, index, "down")}
                        disabled={!active || index === sections.length - 1}
                        aria-label="Descendre"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn-cartoon btn-secondary h-8 w-8 p-0"
                        onClick={() => toggleSectionVisibility(page, section.id)}
                        disabled={!active}
                        aria-label={section.visible ? "Masquer" : "Afficher"}
                      >
                        {section.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      {isCustom && (
                        <button
                          type="button"
                          className="btn-cartoon btn-primary h-8 w-8 p-0"
                          onClick={() => removeCustomSection(page, section.id)}
                          disabled={!active}
                          aria-label="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-charcoal">
            Ordre public visible: {publicOrderLabel || "Aucune section visible"}
          </p>

          {addingCustomByPage[page] && (
            <div className="cartoon-border mt-3 bg-cream p-4">
              <h4 className="font-display text-xl text-ink">Nouvelle section custom</h4>
              <div className="mt-3 grid gap-3">
                <TextFieldControl
                  field={{ path: "custom.title", label: "Titre", placeholder: "Titre", type: "input" }}
                  value={customDraftByPage[page].title}
                  onChange={(value) => updateCustomDraft(page, "title", value)}
                  active={active}
                />
                <TextFieldControl
                  field={{ path: "custom.body", label: "Texte", placeholder: "Texte libre", type: "textarea", minHeightClass: "min-h-20" }}
                  value={customDraftByPage[page].body}
                  onChange={(value) => updateCustomDraft(page, "body", value)}
                  active={active}
                />
                <div className="grid gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-charcoal">Couleur</span>
                  <div className="flex flex-wrap gap-2">
                    {SECTION_STYLE_OPTIONS.map((style) => (
                      <button
                        key={`${page}-custom-style-${style}`}
                        type="button"
                        className={`btn-cartoon btn-secondary px-3 py-1 text-xs ${customDraftByPage[page].style === style ? "bg-[#1a1a1a] text-white" : ""}`}
                        onClick={() => updateCustomDraft(page, "style", style)}
                        disabled={!active}
                      >
                        {STYLE_LABELS[style]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-cartoon btn-primary px-3 py-1 text-xs"
                    onClick={() => addCustomSection(page)}
                    disabled={!active}
                  >
                    Ajouter
                  </button>
                  <button
                    type="button"
                    className="btn-cartoon btn-secondary px-3 py-1 text-xs"
                    onClick={() => setAddingCustomByPage((current) => ({ ...current, [page]: false }))}
                    disabled={!active}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {!selectedSection ? (
          <div className="cartoon-border bg-white p-4 text-sm text-charcoal">Selectionne une section.</div>
        ) : (
          <section className="admin-field-group">
            <h3 className="font-display text-2xl text-ink">Edition de la section</h3>
            <p className="mt-1 text-sm text-charcoal">
              {selectedSection.type === "custom" ? "Section custom" : getNativeSectionLabel(page, selectedSection.type)}
            </p>
            <div className="mt-3">
              {selectedSection.type === "custom" ? (
                <div className="grid gap-3">
                  <TextFieldControl
                    field={{ path: "custom.edit.title", label: "Titre", placeholder: "Titre", type: "input" }}
                    value={selectedSection.custom.title}
                    onChange={(value) => updateCustomSection(page, selectedSection.id, "title", value)}
                    active={active}
                  />
                  <TextFieldControl
                    field={{ path: "custom.edit.body", label: "Texte", placeholder: "Texte", type: "textarea", minHeightClass: "min-h-20" }}
                    value={selectedSection.custom.body}
                    onChange={(value) => updateCustomSection(page, selectedSection.id, "body", value)}
                    active={active}
                  />
                  <div className="grid gap-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-charcoal">Couleur</span>
                    <div className="flex flex-wrap gap-2">
                      {SECTION_STYLE_OPTIONS.map((style) => (
                        <button
                          key={`${page}-${selectedSection.id}-style-${style}`}
                          type="button"
                          className={`btn-cartoon btn-secondary px-3 py-1 text-xs ${selectedSection.custom.style === style ? "bg-[#1a1a1a] text-white" : ""}`}
                          onClick={() => updateCustomSection(page, selectedSection.id, "style", style)}
                          disabled={!active}
                        >
                          {STYLE_LABELS[style]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                renderNativeEditor(page, selectedSection.type, active)
              )}
            </div>
          </section>
        )}
      </div>
    );
  };

  return (
    <section className="cartoon-border bg-cream p-6 md:p-8" role="region" aria-roledescription="carousel" aria-label="Edition textes par page" tabIndex={0} onKeyDown={onKeyDown}>
      <div className="flex items-center justify-between gap-4">
        <button type="button" className="btn-cartoon btn-secondary admin-carousel-arrow" onClick={() => goToSlide(currentSlide - 1)} disabled={currentSlide === 0} aria-label="Slide precedente">
          <ChevronLeft size={18} />
        </button>

        <div className="flex flex-1 flex-col items-center gap-2 text-center">
          <div className="inline-flex items-center gap-2">
            <activeSlide.icon size={20} />
            <h2 className="font-display text-3xl">{activeSlide.label}</h2>
          </div>
          <p className="text-sm font-semibold text-charcoal">{currentSlide + 1} / {totalSlides}</p>
          <div className="flex items-center gap-2">
            {SLIDES.map((slide, index) => (
              <button
                key={slide.key}
                type="button"
                className={`admin-carousel-dot ${index === currentSlide ? "admin-carousel-dot--active" : ""}`}
                onClick={() => goToSlide(index)}
                aria-label={`Aller a la slide ${slide.label}`}
                aria-current={index === currentSlide ? "true" : undefined}
              />
            ))}
          </div>
        </div>

        <button type="button" className="btn-cartoon btn-secondary admin-carousel-arrow" onClick={() => goToSlide(currentSlide + 1)} disabled={currentSlide === totalSlides - 1} aria-label="Slide suivante">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="admin-carousel mt-6">
        <div className="admin-carousel-track" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
          {SLIDES.map((slide, index) => {
            const isActive = index === currentSlide;

            return (
              <div key={slide.key} role="tabpanel" aria-hidden={!isActive} className="admin-carousel-slide">
                {slide.sectionPage ? (
                  renderSectionManager(slide.sectionPage, isActive)
                ) : (
                  <section className="admin-field-group">
                    <h3 className="font-display text-2xl text-ink">Textes Footer</h3>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {FOOTER_FIELDS.map((field) => (
                        <TextFieldControl
                          key={`footer-${field.path}`}
                          field={field}
                          value={readContentValue(field.path)}
                          onChange={(value) => writeContentValue(field.path, value)}
                          active={isActive}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
