"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
    <article key={post.id} className={`card-cartoon overflow-hidden bg-cream ${className}`.trim()}>
      <Link href={`/blog/${post.slug}`} className="block">
        <div className="relative aspect-[4/3] border-b-2 border-[#1a1a1a] bg-[#f7f4ee]">
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            sizes="(max-width: 1024px) 82vw, 33vw"
            className="object-contain transition-transform duration-300 hover:scale-105"
          />
        </div>
      </Link>
      <div className="p-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-charcoal">
          {BLOG_CATEGORY_LABELS[post.category]}
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
          {readMoreLabel}
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
    <div className="grid gap-5">
      <div className="cartoon-border bg-cream p-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={`pill-cartoon px-4 py-2 text-xs uppercase tracking-[0.09em] ${
              activeCategory === "all" ? "bg-[#1a1a1a] text-white" : "bg-white text-ink"
            }`}
          >
            Tous
          </button>
          {availableCategories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setCategory(category)}
              className={`pill-cartoon px-4 py-2 text-xs uppercase tracking-[0.09em] ${
                activeCategory === category ? "bg-[#1a1a1a] text-white" : "bg-white text-ink"
              }`}
            >
              {BLOG_CATEGORY_LABELS[category]}
            </button>
          ))}
        </div>
      </div>

      {filteredPosts.length === 0 ? (
        <div className="cartoon-border bg-cream p-8 text-center text-charcoal">{emptyLabel}</div>
      ) : (
        <>
          <div
            ref={mobileViewportRef}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 lg:hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {filteredPosts.map((post) => (
              <div key={post.id} className="min-w-[82vw] snap-center sm:min-w-[62vw] md:min-w-[46vw]">
                <BlogPostCard post={post} readMoreLabel={readMoreLabel} className="h-full" />
              </div>
            ))}
          </div>

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
