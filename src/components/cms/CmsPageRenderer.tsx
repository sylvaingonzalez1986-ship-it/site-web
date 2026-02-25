import type { CmsPage } from "@/types/cms-pages";

function toParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function sectionStyleClass(style: CmsPage["sections"][number]["style"]): string {
  if (style === "mint") {
    return "bg-mint";
  }
  if (style === "yellow") {
    return "bg-yellow";
  }
  return "bg-cream";
}

export function CmsPageRenderer({ page }: { page: CmsPage }) {
  return (
    <section className="section-band bg-cream halftone-overlay paper-grain pt-32">
      <div className="retro-container">
        <article className="cartoon-border bg-white p-6 md:p-10">
          <h1 className="section-title">{page.title}</h1>
          {page.description && (
            <p className="mt-4 text-sm leading-relaxed text-charcoal">{page.description}</p>
          )}

          <div className="mt-6 grid gap-6">
            {page.sections.length === 0 ? (
              <section className="text-sm text-charcoal">Cette page est vide pour le moment.</section>
            ) : (
              page.sections.map((section) => (
                <section
                  key={section.id}
                  className={`cartoon-border-sm ${sectionStyleClass(section.style)} p-4 md:p-5`}
                >
                  {section.title && <h2 className="font-display text-2xl text-ink">{section.title}</h2>}
                  <div className="mt-2 grid gap-3 text-sm leading-relaxed text-ink">
                    {toParagraphs(section.body).map((paragraph, index) => (
                      <p key={`${section.id}-${index}`} className="whitespace-pre-line">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
