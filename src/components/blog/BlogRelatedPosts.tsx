import Image from "next/image";
import Link from "next/link";
import { shouldUseNativeImg } from "@/lib/image-source";
import type { BlogPost } from "@/types/store";

type BlogRelatedPostsProps = {
  currentPostId: string;
  currentCategory: string;
  posts: BlogPost[];
};

export function BlogRelatedPosts({ currentPostId, currentCategory, posts }: BlogRelatedPostsProps) {
  const related = posts
    .filter((post) => post.published && post.id !== currentPostId && post.category === currentCategory)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);

  if (related.length === 0) {
    return null;
  }

  return (
    <div className="cartoon-border bg-white p-5">
      <h2 className="font-display text-2xl text-ink">A lire aussi</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {related.map((post) => (
          <article key={post.id} className="rounded border-2 border-[#1a1a1a] bg-[#f7f4ee]">
            <Link href={`/blog/${post.slug}`} className="block">
              <div className="relative aspect-[4/3] border-b-2 border-[#1a1a1a] bg-[#f7f4ee]">
                {shouldUseNativeImg(post.coverImage) ? (
                  <img
                    src={post.coverImage}
                    alt={post.title}
                    className="absolute inset-0 h-full w-full object-contain"
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
                    className="object-contain"
                  />
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold text-ink">{post.title}</p>
                <p className="mt-1 text-xs text-charcoal">
                  {new Date(post.createdAt).toLocaleDateString("fr-FR")}
                </p>
              </div>
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
