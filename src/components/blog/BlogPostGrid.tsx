"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { shouldUseNativeImg } from "@/lib/image-source";
import type { BlogPost } from "@/types/store";

const blogCategoryLabels: Record<string, string> = {
  guide: "Guide",
  actualite: "Actualite",
  "bien-etre": "Bien-etre",
  legislation: "Legislation",
  chronique: "Chronique d'un chanvrier",
};

type BlogPostGridProps = {
  posts: BlogPost[];
  readMoreLabel: string;
  emptyLabel: string;
};

function BlogPostGridInner({ posts, readMoreLabel, emptyLabel }: BlogPostGridProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const categoryParam = (searchParams.get("categorie") ?? "").trim();

  const availableCategories = useMemo(
    () => Array.from(new Set(posts.map((post) => post.category))).sort(),
    [posts],
  );

  const activeCategory = (availableCategories as string[]).includes(categoryParam) ? categoryParam : "all";

  const filteredPosts = useMemo(() => {
    const source = [...posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (activeCategory === "all") {
      return source;
    }
    return source.filter((post) => post.category === activeCategory);
  }, [posts, activeCategory]);

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
              {blogCategoryLabels[category] ?? category}
            </button>
          ))}
        </div>
      </div>

      {filteredPosts.length === 0 ? (
        <div className="cartoon-border bg-cream p-8 text-center text-charcoal">{emptyLabel}</div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredPosts.map((post) => (
            <article key={post.id} className="card-cartoon overflow-hidden bg-cream">
              <Link href={`/blog/${post.slug}`} className="block">
                <div className="relative aspect-[4/3] border-b-2 border-[#1a1a1a] bg-[#f7f4ee]">
                  {shouldUseNativeImg(post.coverImage) ? (
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      className="absolute inset-0 h-full w-full object-contain transition-transform duration-300 hover:scale-105"
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
                      className="object-contain transition-transform duration-300 hover:scale-105"
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
                  {readMoreLabel}
                </Link>
              </div>
            </article>
          ))}
        </div>
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
