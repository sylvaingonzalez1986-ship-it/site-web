import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/JsonLd";
import { getBlogPostBySlugByBackend, readPublicStoreByBackend } from "@/lib/data-backend";
import { getSiteUrl } from "@/lib/site-url";

export const revalidate = 300;

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

const blogCategoryLabels: Record<string, string> = {
  guide: "Guide",
  actualite: "Actualité",
  "bien-etre": "Bien-être",
  legislation: "Législation",
};

const blogCategoryShopLinks: Record<string, Array<{ href: string; label: string }>> = {
  guide: [
    { href: "/boutique/fleurs-cbd", label: "Découvrir nos Fleurs CBD" },
    { href: "/boutique/huiles-cbd", label: "Voir nos Huiles CBD" },
    { href: "/boutique/tisane-cbd", label: "Explorer nos Tisanes CBD" },
  ],
  actualite: [
    { href: "/boutique", label: "Voir toute la boutique CBD" },
    { href: "/boutique/fleurs-cbd", label: "Nouveautés Fleurs CBD" },
  ],
  "bien-etre": [
    { href: "/boutique/huiles-cbd", label: "Huiles CBD bien-être" },
    { href: "/boutique/tisane-cbd", label: "Tisanes chanvre relaxation" },
    { href: "/boutique/cosmetiques-cbd", label: "Cosmétiques CBD" },
  ],
  legislation: [
    { href: "/boutique/fleurs-cbd", label: "Fleurs CBD conformes" },
    { href: "/boutique/resines-cbd", label: "Résines CBD analysées" },
  ],
};

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlugByBackend(slug);

  if (!post) {
    return {
      title: "Article introuvable",
      robots: { index: false, follow: false },
    };
  }

  const baseUrl = getSiteUrl();
  const canonicalUrl = `${baseUrl}/blog/${post.slug}`;

  return {
    title: post.title,
    description: post.excerpt,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: canonicalUrl,
      type: "article",
      images: [{ url: `${baseUrl}${post.coverImage}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [`${baseUrl}${post.coverImage}`],
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getBlogPostBySlugByBackend(slug);
  const baseUrl = getSiteUrl();

  if (!post) {
    notFound();
  }

  const store = await readPublicStoreByBackend();
  const blogContent = store.content.blog;

  const canonicalUrl = `${baseUrl}/blog/${post.slug}`;
  const paragraphs = post.content
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
  const relatedShopLinks = blogCategoryShopLinks[post.category] ?? [
    { href: "/boutique", label: "Voir la boutique CBD" },
  ];

  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-32">
      <BreadcrumbJsonLd
        items={[
          { name: blogContent.breadcrumbHomeLabel, url: baseUrl },
          { name: blogContent.breadcrumbBlogLabel, url: `${baseUrl}/blog` },
          { name: post.title, url: canonicalUrl },
        ]}
      />
      <ArticleJsonLd
        title={post.title}
        description={post.excerpt}
        url={canonicalUrl}
        image={`${baseUrl}${post.coverImage}`}
        datePublished={post.createdAt}
        dateModified={post.updatedAt}
        category={blogCategoryLabels[post.category] ?? post.category}
      />

      <div className="retro-container">
        <div className="cartoon-border bg-cream p-8">
          <nav className="mb-4 text-sm text-charcoal" aria-label="Fil d'Ariane">
            <Link href="/" className="hover:text-ink underline">
              {blogContent.breadcrumbHomeLabel}
            </Link>
            {" > "}
            <Link href="/blog" className="hover:text-ink underline">
              {blogContent.breadcrumbBlogLabel}
            </Link>
            {" > "}
            <span className="font-bold text-ink">{post.title}</span>
          </nav>

          <p className="pill-cartoon inline-flex px-4 py-2 text-xs uppercase tracking-[0.12em]">
            {blogCategoryLabels[post.category] ?? post.category}
          </p>
          <h1 className="section-title mt-5 text-ink">{post.title}</h1>
          <p className="mt-2 text-sm text-charcoal">
            {blogContent.postPublishedPrefix} {new Date(post.createdAt).toLocaleDateString("fr-FR")}
          </p>
          <p className="mt-4 text-lg leading-relaxed text-charcoal">{post.excerpt}</p>
        </div>

        <article className="cartoon-border mt-8 overflow-hidden bg-cream">
          <div className="relative aspect-[16/8] border-b-2 border-[#1a1a1a]">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          </div>

          <div className="p-8">
            <div className="grid gap-5 text-base leading-relaxed text-charcoal">
              {paragraphs.length > 0 ? (
                paragraphs.map((paragraph, index) => (
                  <p key={`${post.id}-paragraph-${index}`}>{paragraph}</p>
                ))
              ) : (
                <p>{post.excerpt}</p>
              )}
            </div>

            <div className="cartoon-border mt-8 bg-white p-5">
              <h2 className="font-display text-2xl text-ink">Produits associés</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {relatedShopLinks.map((link) => (
                  <Link
                    key={`${post.id}-${link.href}`}
                    href={link.href}
                    className="btn-cartoon btn-secondary inline-flex h-10 items-center px-4 text-xs"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-8">
              <Link href="/blog" className="btn-cartoon btn-secondary inline-flex h-10 items-center px-4 text-xs">
                {blogContent.postBackLabel}
              </Link>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
