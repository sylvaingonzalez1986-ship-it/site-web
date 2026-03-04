import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CustomSection } from "@/components/CustomSection";
import { BreadcrumbJsonLd } from "@/components/JsonLd";
import { readPublicStoreByBackend } from "@/lib/data-backend";
import { shouldUseNativeImg } from "@/lib/image-source";
import { getSiteUrl } from "@/lib/site-url";
import type { BlogPageSection } from "@/types/store";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Blog CBD | Guides, Actualités et Conseils Chanvre Bio Breton",
  description:
    "Retrouvez nos guides, actualités et conseils autour du CBD bio breton. Législation CBD en France, bien-être au chanvre, astuces et nouveautés des Chanvriers Bretons.",
  alternates: {
    canonical: "https://leschanvriersbretons.com/blog",
  },
  openGraph: {
    title: "Blog CBD — Les Chanvriers Bretons",
    description:
      "Guides, actualités et conseils autour du CBD bio. Législation, bien-être et nouveautés chanvre breton.",
    url: "https://leschanvriersbretons.com/blog",
  },
};

const blogCategoryLabels: Record<string, string> = {
  guide: "Guide",
  actualite: "Actualité",
  "bien-etre": "Bien-être",
  legislation: "Législation",
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
          <div key={section.id} className={`cartoon-border bg-cream p-8 ${spacingClass}`}>
            <p className="pill-cartoon px-4 py-2 text-xs uppercase tracking-[0.12em]">
              {store.content.blog.eyebrow}
            </p>
            <h1 className="section-title mt-5 text-ink">{store.content.blog.title}</h1>
            <p className="mt-4 max-w-3xl text-lg leading-relaxed text-charcoal">
              {store.content.blog.description}
            </p>
          </div>
        );
      case "posts":
        return (
          <div key={section.id} className={spacingClass}>
            {posts.length === 0 ? (
              <div className="cartoon-border bg-cream p-8 text-center text-charcoal">
                {store.content.blog.postsEmptyMessage}
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) => (
                  <article key={post.id} className="card-cartoon overflow-hidden bg-cream">
                    <Link href={`/blog/${post.slug}`} className="block">
                      <div className="relative aspect-[4/3] border-b-2 border-[#1a1a1a]">
                        {shouldUseNativeImg(post.coverImage) ? (
                          <img
                            src={post.coverImage}
                            alt={post.title}
                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Image
                            src={post.coverImage}
                            alt={post.title}
                            fill
                            sizes="(max-width: 1024px) 50vw, 33vw"
                            className="object-cover transition-transform duration-300 hover:scale-105"
                          />
                        )}
                      </div>
                    </Link>
                    <div className="p-5">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-charcoal">
                        {blogCategoryLabels[post.category] ?? post.category}
                      </p>
                      <h2 className="mt-2 font-display text-2xl text-ink">
                        <Link href={`/blog/${post.slug}`} className="hover:underline">
                          {post.title}
                        </Link>
                      </h2>
                      <p className="mt-2 text-sm text-charcoal">
                        {new Date(post.createdAt).toLocaleDateString("fr-FR")}
                      </p>
                      <p className="mt-3 text-sm leading-relaxed text-charcoal">{post.excerpt}</p>
                      <Link
                        href={`/blog/${post.slug}`}
                        className="btn-cartoon btn-secondary mt-4 inline-flex h-10 items-center px-4 text-xs"
                      >
                        {store.content.blog.postsReadMoreLabel}
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
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
