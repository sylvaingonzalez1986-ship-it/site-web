import type { Metadata } from "next";
import { BlogPostGrid } from "@/components/blog/BlogPostGrid";
import { CustomSection } from "@/components/CustomSection";
import { EditorialWorldHero } from "@/components/EditorialWorldHero";
import { BreadcrumbJsonLd } from "@/components/JsonLd";
import { readPublicStoreByBackend } from "@/lib/data-backend";
import { getSiteUrl } from "@/lib/site-url";
import type { BlogPageSection } from "@/types/store";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Blog CBD | Guides, Actualites et Conseils Chanvre Bio Breton",
  description:
    "Retrouvez nos guides, actualites et conseils autour du CBD bio breton. Legislation CBD en France, bien-etre au chanvre, astuces et nouveautes des Chanvriers Bretons.",
  alternates: {
    canonical: "https://leschanvriersbretons.com/blog",
  },
  openGraph: {
    title: "Blog CBD - Les Chanvriers Bretons",
    description:
      "Guides, actualites et conseils autour du CBD bio. Legislation, bien-etre et nouveautes chanvre breton.",
    url: "https://leschanvriersbretons.com/blog",
  },
};

export default async function BlogPage() {
  const store = await readPublicStoreByBackend();
  const posts = [...store.blog].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const visibleSections = store.sections.blog;
  const baseUrl = getSiteUrl();

  const renderBlogSection = (section: BlogPageSection, index: number) => {
    const spacingClass = index === 0 ? "" : "mt-8";

    switch (section.type) {
      case "header":
        return (
          <EditorialWorldHero
            key={section.id}
            world="journal"
            eyebrow={store.content.blog.eyebrow}
            title={store.content.blog.title}
            description={store.content.blog.description}
            imageSrc="/mascots/blog-journal.png"
            imageAlt="Sylvain prépare un article dans son carnet de terrain"
            className={spacingClass}
          />
        );
      case "posts":
        return (
          <div key={section.id} className={spacingClass}>
            <BlogPostGrid
              posts={posts}
              readMoreLabel={store.content.blog.postsReadMoreLabel}
              emptyLabel={store.content.blog.postsEmptyMessage}
            />
          </div>
        );
      case "custom":
        return (
          <CustomSection
            key={section.id}
            id={section.id}
            custom={section.custom}
            variant="card"
            className={spacingClass}
          />
        );
      default:
        return null;
    }
  };

  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-32">
      <BreadcrumbJsonLd
        items={[
          { name: store.content.blog.breadcrumbHomeLabel, url: baseUrl },
          { name: store.content.blog.breadcrumbBlogLabel, url: `${baseUrl}/blog` },
        ]}
      />
      <div className="retro-container">
        {visibleSections.map((section, index) => renderBlogSection(section, index))}
      </div>
    </section>
  );
}
