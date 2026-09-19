import type { Metadata } from "next";
import Image from "next/image";
import Link from "@/components/navigation/NavigationLink";
import { notFound } from "next/navigation";
import { BlogCommentSection } from "@/components/blog/BlogCommentSection";
import { BlogRelatedPosts } from "@/components/blog/BlogRelatedPosts";
import { BlogShareButtons } from "@/components/blog/BlogShareButtons";
import { BlogStarRating } from "@/components/blog/BlogStarRating";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/JsonLd";
import { BLOG_CATEGORY_LABELS, BLOG_CATEGORY_SHOP_LINKS } from "@/lib/blog-categories";
import { getActiveCatalogCategories } from "@/lib/catalog-categories";
import { getBlogRatingStats } from "@/lib/blog-interactions-backend";
import { getBlogPostBySlugByBackend, readPublicStoreByBackend } from "@/lib/data-backend";
import { computeReadingTimeMinutes } from "@/lib/reading-time";
import { getSiteUrl } from "@/lib/site-url";
import styles from "@/components/blog/Blog.module.css";

export const revalidate = 300;

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

function asAbsoluteUrl(baseUrl: string, image: string): string {
  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }
  return `${baseUrl}${image}`;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
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
  const coverImage = asAbsoluteUrl(baseUrl, post.coverImage);

  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: canonicalUrl,
      type: "article",
      images: [{ url: coverImage }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [coverImage],
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
  const readingMinutes = computeReadingTimeMinutes(post.content);
  const activeCategoryPaths = new Set(
    getActiveCatalogCategories(store.products).map(({ slug: categorySlug }) => `/boutique/${categorySlug}`),
  );
  const configuredShopLinks = BLOG_CATEGORY_SHOP_LINKS[post.category] ?? [];
  const activeShopLinks = configuredShopLinks.filter(
    ({ href }) => href === "/boutique" || activeCategoryPaths.has(href),
  );
  const relatedShopLinks = activeShopLinks.length > 0
    ? activeShopLinks
    : [{ href: "/boutique", label: "Voir la boutique CBD" }];
  const coverImage = asAbsoluteUrl(baseUrl, post.coverImage);
  const ratingStats = await getBlogRatingStats(post.id);
  const wordCount = post.content.trim() ? post.content.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <section className={`section-band paper-grain pt-32 ${styles.page}`}>
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
        image={coverImage}
        datePublished={post.createdAt}
        dateModified={post.updatedAt}
        category={BLOG_CATEGORY_LABELS[post.category]}
        wordCount={wordCount}
        ratingValue={ratingStats.averageRating}
        ratingCount={ratingStats.totalRatings}
      />

      <div className="retro-container">
        <header className={styles.articleHeader}>
          <nav className={styles.breadcrumb} aria-label="Fil d'Ariane">
            <Link href="/" className="underline">
              {blogContent.breadcrumbHomeLabel}
            </Link>
            {" > "}
            <Link href="/blog" className="underline">
              {blogContent.breadcrumbBlogLabel}
            </Link>
            {" > "}
            <span aria-current="page">{post.title}</span>
          </nav>

          <p className={styles.articleCategory}>
            {BLOG_CATEGORY_LABELS[post.category]}
          </p>
          <h1 className={styles.articleTitle}>{post.title}</h1>
          <p className={styles.articleMeta}>
            {blogContent.postPublishedPrefix} <time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleDateString("fr-FR")}</time> ·{" "}
            {readingMinutes} min de lecture
          </p>
          <p className={styles.articleExcerpt}>{post.excerpt}</p>
          <div className="mt-6">
            <BlogStarRating postId={post.id} />
          </div>
        </header>

        <article className={styles.article}>
          <div className={styles.cover}>
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              priority
              sizes="100vw"
              className="object-contain"
            />
          </div>

          <div className={styles.articleBody}>
            <BlogShareButtons url={canonicalUrl} title={post.title} excerpt={post.excerpt} />

            <div className={styles.prose}>
              {paragraphs.length > 0 ? (
                paragraphs.map((paragraph, index) => <p key={`${post.id}-paragraph-${index}`}>{paragraph}</p>)
              ) : (
                <p>{post.excerpt}</p>
              )}
            </div>

            <div className={styles.shopPanel}>
              <h2 className={styles.panelTitle}>Du journal au marché</h2>
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
              <BlogRelatedPosts currentPostId={post.id} currentCategory={post.category} posts={store.blog} />
            </div>

            <div className="mt-8">
              <BlogCommentSection postId={post.id} />
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
