"use client";

import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { computeReadingTimeMinutes } from "@/lib/reading-time";
import styles from "./Blog.module.css";
import Link from "@/components/navigation/NavigationLink";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useRouter } from "@/components/navigation/NavigationFeedback";
import { BLOG_CATEGORY_LABELS } from "@/lib/blog-categories";
import { BLOG_CATEGORY_OPTIONS, type BlogCategory, type BlogPost } from "@/types/store";

type BlogPostGridProps = {
  posts: BlogPost[];
  readMoreLabel: string;
  emptyLabel: string;
};

type BlogPostCardProps = {
  post: BlogPost;
  readMoreLabel: string;
  className?: string;
};

function BlogPostCard({ post, readMoreLabel, className = "" }: BlogPostCardProps) {
  return (
    <article key={post.id} className={`${styles.card} ${className}`.trim()}>
      <Link href={`/blog/${post.slug}`} className="block">
        <div className={styles.media}>
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            sizes="(max-width: 1024px) 82vw, 33vw"
            className="object-contain transition-transform duration-300 hover:scale-105"
          />
        </div>
      </Link>
      <div className={styles.cardBody}>
        <p className={styles.category}>
          {BLOG_CATEGORY_LABELS[post.category]}
        </p>
        <h3 className={styles.cardTitle}>
          <Link href={`/blog/${post.slug}`} className="hover:underline">
            {post.title}
          </Link>
        </h3>
        <p className={styles.cardMeta}>
          <time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleDateString("fr-FR")}</time>
          <span>{computeReadingTimeMinutes(post.content)} min de lecture</span>
        </p>
        <p className={styles.excerpt}>{post.excerpt}</p>
        <Link
          href={`/blog/${post.slug}`}
          className="btn-cartoon btn-primary"
        >
          {readMoreLabel} <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

function BlogPostGridInner({ posts, readMoreLabel, emptyLabel }: BlogPostGridProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mobileViewportRef = useRef<HTMLDivElement>(null);
  const categoryParam = (searchParams.get("categorie") ?? "").trim();

  const availableCategories = useMemo(
    () => {
      const visibleCategories = new Set(posts.map((post) => post.category));
      return BLOG_CATEGORY_OPTIONS.filter((category) => visibleCategories.has(category));
    },
    [posts],
  );

  const activeCategory: BlogCategory | "all" = availableCategories.includes(categoryParam as BlogCategory)
    ? (categoryParam as BlogCategory)
    : "all";

  const filteredPosts = useMemo(() => {
    const source = [...posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (activeCategory === "all") {
      return source;
    }
    return source.filter((post) => post.category === activeCategory);
  }, [posts, activeCategory]);

  useEffect(() => {
    mobileViewportRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  }, [activeCategory]);

  const setCategory = (nextCategory: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextCategory === "all") {
      params.delete("categorie");
    } else {
      params.set("categorie", nextCategory);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div className={styles.grid}>
      <div className={styles.filters}>
        <p className={styles.filterLabel}>Les rubriques du journal</p>
        <div className={styles.filterButtons} role="group" aria-label="Filtrer les articles par rubrique">
          <button
            type="button"
            onClick={() => setCategory("all")}
            aria-pressed={activeCategory === "all"}
          >
            Tous
          </button>
          {availableCategories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setCategory(category)}
              aria-pressed={activeCategory === category}
            >
              {BLOG_CATEGORY_LABELS[category]}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.sectionHeading}>
        <h2>{activeCategory === "all" ? "Tous les articles" : BLOG_CATEGORY_LABELS[activeCategory]}</h2>
        <p className={styles.count} role="status">{filteredPosts.length} article{filteredPosts.length > 1 ? "s" : ""}</p>
      </div>
      {filteredPosts.length === 0 ? (
        <div className={styles.empty}>{emptyLabel}</div>
      ) : (
        <>
          <div
            ref={mobileViewportRef}
            className={`flex snap-x snap-mandatory gap-4 overflow-x-auto lg:hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${styles.track}`}
            tabIndex={0}
            role="region"
            aria-label="Articles du journal, carrousel"
          >
            {filteredPosts.map((post) => (
              <div key={post.id} className={styles.mobileCard}>
                <BlogPostCard post={post} readMoreLabel={readMoreLabel} className="h-full" />
              </div>
            ))}
          </div>

          <p className={`lg:hidden ${styles.trackHint}`}>Fais défiler pour découvrir les articles →</p>
          <div className="hidden gap-5 lg:grid lg:grid-cols-3">
            {filteredPosts.map((post) => (
              <BlogPostCard key={post.id} post={post} readMoreLabel={readMoreLabel} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function BlogPostGrid(props: BlogPostGridProps) {
  return (
    <Suspense fallback={null}>
      <BlogPostGridInner {...props} />
    </Suspense>
  );
}
