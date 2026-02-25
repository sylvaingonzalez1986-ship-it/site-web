"use client";

import { Archive, Copy, Plus, RefreshCcw, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { normalizeCmsSlug } from "@/lib/cms-pages-slugs";
import type {
  CmsPage,
  CmsPageCreateInput,
  CmsPageSection,
  CmsPageStatus,
} from "@/types/cms-pages";
import { SECTION_STYLE_OPTIONS, type SectionStyle } from "@/types/store";

const STATUS_OPTIONS: CmsPageStatus[] = ["draft", "published", "archived"];

function createSectionDraft(index: number): CmsPageSection {
  return {
    id: `section-${Date.now()}-${index}`,
    title: "",
    body: "",
    style: "cream",
  };
}

function createSlugWithCopySuffix(baseSlug: string): string {
  const normalizedBase = normalizeCmsSlug(baseSlug) || "nouvelle-page";
  return `${normalizedBase}-copie-${Math.floor(Math.random() * 900 + 100)}`;
}

function mapPageToDraft(page: CmsPage): CmsPage {
  return {
    ...page,
    sections: page.sections.map((section) => ({ ...section })),
  };
}

export function AdminPagesPanel() {
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CmsPage | null>(null);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageSlug, setNewPageSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("Chargement...");

  const sortedPages = useMemo(
    () => [...pages].sort((a, b) => a.position - b.position || a.title.localeCompare(b.title)),
    [pages],
  );

  const loadPages = async () => {
    setLoading(true);
    setStatusMessage("Chargement des pages...");

    try {
      const response = await fetch("/api/admin/pages", { cache: "no-store" });
      const payload = (await response.json()) as { pages?: CmsPage[]; error?: string };

      if (!response.ok) {
        setStatusMessage(payload.error || "Impossible de charger les pages.");
        return;
      }

      const nextPages = Array.isArray(payload.pages) ? payload.pages : [];
      setPages(nextPages);
      setSelectedPageId((current) => {
        if (current && nextPages.some((page) => page.id === current)) {
          return current;
        }
        return nextPages[0]?.id ?? null;
      });
      setStatusMessage("Pages chargees.");
    } catch {
      setStatusMessage("Erreur reseau pendant le chargement des pages.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPages();
  }, []);

  useEffect(() => {
    if (!selectedPageId) {
      setDraft(null);
      return;
    }

    const selected = pages.find((page) => page.id === selectedPageId) ?? null;
    setDraft(selected ? mapPageToDraft(selected) : null);
  }, [pages, selectedPageId]);

  const createPage = async () => {
    const title = newPageTitle.trim();
    const slug = normalizeCmsSlug(newPageSlug || title);
    if (!title || !slug) {
      setStatusMessage("Titre et slug obligatoires.");
      return;
    }

    setSaving(true);
    setStatusMessage("Creation de la page...");
    const payload: CmsPageCreateInput = {
      title,
      slug,
      status: "draft",
      sections: [createSectionDraft(1)],
      showInNav: false,
      showInFooter: false,
      navLabel: "",
      footerLabel: "",
      position: pages.length,
    };

    try {
      const response = await fetch("/api/admin/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as CmsPage | { error?: string };

      if (!response.ok) {
        setStatusMessage((data as { error?: string }).error || "Creation impossible.");
        return;
      }

      const created = data as CmsPage;
      setPages((current) => [...current, created]);
      setSelectedPageId(created.id);
      setNewPageTitle("");
      setNewPageSlug("");
      setStatusMessage("Page creee.");
    } catch {
      setStatusMessage("Erreur reseau pendant la creation.");
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    if (!draft) {
      return;
    }

    setSaving(true);
    setStatusMessage("Sauvegarde de la page...");

    try {
      const response = await fetch(`/api/admin/pages/${encodeURIComponent(draft.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          slug: draft.slug,
          description: draft.description,
          status: draft.status,
          sections: draft.sections,
          seoTitle: draft.seoTitle ?? "",
          seoDescription: draft.seoDescription ?? "",
          showInNav: draft.showInNav,
          showInFooter: draft.showInFooter,
          navLabel: draft.navLabel,
          footerLabel: draft.footerLabel,
          position: draft.position,
        }),
      });

      const data = (await response.json()) as CmsPage | { error?: string };
      if (!response.ok) {
        setStatusMessage((data as { error?: string }).error || "Sauvegarde impossible.");
        return;
      }

      const updated = data as CmsPage;
      setPages((current) => current.map((page) => (page.id === updated.id ? updated : page)));
      setStatusMessage("Page sauvegardee.");
    } catch {
      setStatusMessage("Erreur reseau pendant la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  const archiveSelectedPage = async () => {
    if (!draft) {
      return;
    }

    setSaving(true);
    setStatusMessage("Archivage de la page...");

    try {
      const response = await fetch(`/api/admin/pages/${encodeURIComponent(draft.id)}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as CmsPage | { error?: string };

      if (!response.ok) {
        setStatusMessage((data as { error?: string }).error || "Archivage impossible.");
        return;
      }

      const updated = data as CmsPage;
      setPages((current) => current.map((page) => (page.id === updated.id ? updated : page)));
      setStatusMessage("Page archivee.");
    } catch {
      setStatusMessage("Erreur reseau pendant l'archivage.");
    } finally {
      setSaving(false);
    }
  };

  const duplicateSelectedPage = async () => {
    if (!draft) {
      return;
    }

    setSaving(true);
    setStatusMessage("Duplication de la page...");

    try {
      const response = await fetch("/api/admin/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${draft.title} (copie)`,
          slug: createSlugWithCopySuffix(draft.slug),
          description: draft.description,
          status: "draft",
          sections: draft.sections,
          seoTitle: draft.seoTitle,
          seoDescription: draft.seoDescription,
          showInNav: false,
          showInFooter: false,
          navLabel: "",
          footerLabel: "",
          position: draft.position + 1,
        } satisfies CmsPageCreateInput),
      });
      const data = (await response.json()) as CmsPage | { error?: string };

      if (!response.ok) {
        setStatusMessage((data as { error?: string }).error || "Duplication impossible.");
        return;
      }

      const created = data as CmsPage;
      setPages((current) => [...current, created]);
      setSelectedPageId(created.id);
      setStatusMessage("Page dupliquee.");
    } catch {
      setStatusMessage("Erreur reseau pendant la duplication.");
    } finally {
      setSaving(false);
    }
  };

  const updateDraft = <K extends keyof CmsPage>(key: K, value: CmsPage[K]) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const updateSection = <K extends keyof CmsPageSection>(
    sectionId: string,
    key: K,
    value: CmsPageSection[K],
  ) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        sections: current.sections.map((section) =>
          section.id === sectionId ? { ...section, [key]: value } : section,
        ),
      };
    });
  };

  const addSection = () => {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        sections: [...current.sections, createSectionDraft(current.sections.length + 1)],
      };
    });
  };

  const removeSection = (sectionId: string) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        sections: current.sections.filter((section) => section.id !== sectionId),
      };
    });
  };

  return (
    <section className="cartoon-border bg-cream p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-3xl text-ink">Pages CMS</h2>
        <button type="button" className="btn-cartoon btn-secondary" onClick={loadPages} disabled={loading}>
          <RefreshCcw size={14} /> Recharger
        </button>
      </div>
      <p className="mt-2 text-sm text-charcoal">{statusMessage}</p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="card-cartoon bg-white p-4">
          <h3 className="font-display text-2xl text-ink">Nouvelle page</h3>
          <div className="mt-3 grid gap-2">
            <input
              className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
              value={newPageTitle}
              onChange={(event) => setNewPageTitle(event.target.value)}
              placeholder="Titre"
              disabled={saving}
            />
            <input
              className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
              value={newPageSlug}
              onChange={(event) => setNewPageSlug(normalizeCmsSlug(event.target.value))}
              placeholder="slug"
              disabled={saving}
            />
            <button type="button" className="btn-cartoon btn-primary" onClick={createPage} disabled={saving}>
              <Plus size={14} /> Creer
            </button>
          </div>

          <h3 className="mt-5 font-display text-2xl text-ink">Liste ({sortedPages.length})</h3>
          <div className="mt-3 grid gap-2">
            {sortedPages.map((page) => (
              <button
                key={page.id}
                type="button"
                onClick={() => setSelectedPageId(page.id)}
                className={`rounded border-2 px-3 py-2 text-left ${
                  selectedPageId === page.id
                    ? "border-[#1a1a1a] bg-[#e8f7f2]"
                    : "border-[#1a1a1a] bg-white hover:bg-[#f7f4ee]"
                }`}
              >
                <p className="text-sm font-semibold text-ink">{page.title}</p>
                <p className="text-xs text-charcoal">/{page.slug}</p>
                <p className="text-xs uppercase tracking-[0.08em] text-charcoal">
                  {page.status} - pos {page.position}
                </p>
              </button>
            ))}
            {!loading && sortedPages.length === 0 && (
              <p className="text-sm text-charcoal">Aucune page CMS pour le moment.</p>
            )}
          </div>
        </aside>

        <div className="card-cartoon bg-white p-4">
          {!draft ? (
            <p className="text-sm text-charcoal">Selectionne une page pour l&apos;editer.</p>
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                  value={draft.title}
                  onChange={(event) => updateDraft("title", event.target.value)}
                  placeholder="Titre"
                  disabled={saving}
                />
                <input
                  className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                  value={draft.slug}
                  onChange={(event) => updateDraft("slug", normalizeCmsSlug(event.target.value))}
                  placeholder="Slug"
                  disabled={saving}
                />
                <input
                  className="h-10 border-2 border-[#1a1a1a] px-2 text-sm md:col-span-2"
                  value={draft.description}
                  onChange={(event) => updateDraft("description", event.target.value)}
                  placeholder="Description courte"
                  disabled={saving}
                />
                <select
                  className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                  value={draft.status}
                  onChange={(event) => updateDraft("status", event.target.value as CmsPageStatus)}
                  disabled={saving}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <input
                  className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                  type="number"
                  min={0}
                  value={draft.position}
                  onChange={(event) => updateDraft("position", Math.max(0, Number(event.target.value) || 0))}
                  placeholder="Position"
                  disabled={saving}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.showInNav}
                    onChange={(event) => updateDraft("showInNav", event.target.checked)}
                    disabled={saving}
                  />
                  Afficher dans la navbar
                </label>
                <input
                  className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                  value={draft.navLabel}
                  onChange={(event) => updateDraft("navLabel", event.target.value)}
                  placeholder="Label navbar (optionnel)"
                  disabled={saving}
                />
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.showInFooter}
                    onChange={(event) => updateDraft("showInFooter", event.target.checked)}
                    disabled={saving}
                  />
                  Afficher dans le footer
                </label>
                <input
                  className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                  value={draft.footerLabel}
                  onChange={(event) => updateDraft("footerLabel", event.target.value)}
                  placeholder="Label footer (optionnel)"
                  disabled={saving}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                  value={draft.seoTitle ?? ""}
                  onChange={(event) => updateDraft("seoTitle", event.target.value)}
                  placeholder="SEO title (optionnel)"
                  disabled={saving}
                />
                <input
                  className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                  value={draft.seoDescription ?? ""}
                  onChange={(event) => updateDraft("seoDescription", event.target.value)}
                  placeholder="SEO description (optionnel)"
                  disabled={saving}
                />
              </div>

              <div className="rounded border-2 border-[#1a1a1a] bg-[#f7f4ee] p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-2xl text-ink">Sections ({draft.sections.length})</h3>
                  <button type="button" className="btn-cartoon btn-secondary h-9 px-3 text-xs" onClick={addSection} disabled={saving}>
                    <Plus size={14} /> Ajouter section
                  </button>
                </div>

                <div className="mt-3 grid gap-3">
                  {draft.sections.map((section) => (
                    <article key={section.id} className="rounded border-2 border-[#1a1a1a] bg-white p-3">
                      <div className="grid gap-2 md:grid-cols-[1fr,160px,auto] md:items-center">
                        <input
                          className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                          value={section.title}
                          onChange={(event) => updateSection(section.id, "title", event.target.value)}
                          placeholder="Titre section"
                          disabled={saving}
                        />
                        <select
                          className="h-10 border-2 border-[#1a1a1a] px-2 text-sm"
                          value={section.style}
                          onChange={(event) =>
                            updateSection(section.id, "style", event.target.value as SectionStyle)
                          }
                          disabled={saving}
                        >
                          {SECTION_STYLE_OPTIONS.map((style) => (
                            <option key={style} value={style}>
                              {style}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn-cartoon btn-primary h-10 px-3 text-xs"
                          onClick={() => removeSection(section.id)}
                          disabled={saving}
                        >
                          <Trash2 size={14} /> Supprimer
                        </button>
                      </div>
                      <textarea
                        className="mt-2 min-h-24 w-full border-2 border-[#1a1a1a] p-2 text-sm"
                        value={section.body}
                        onChange={(event) => updateSection(section.id, "body", event.target.value)}
                        placeholder="Contenu section"
                        disabled={saving}
                      />
                    </article>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-cartoon btn-primary" onClick={saveDraft} disabled={saving}>
                  <Save size={14} /> Sauvegarder
                </button>
                <button
                  type="button"
                  className="btn-cartoon btn-secondary"
                  onClick={duplicateSelectedPage}
                  disabled={saving}
                >
                  <Copy size={14} /> Dupliquer
                </button>
                <button
                  type="button"
                  className="btn-cartoon btn-secondary"
                  onClick={archiveSelectedPage}
                  disabled={saving}
                >
                  <Archive size={14} /> Archiver
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
