import Image from "next/image";
import Link from "@/components/navigation/NavigationLink";
import type { BlogPost } from "@/types/store";
import styles from "./Blog.module.css";

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
    <div className={styles.panel}>
      <h2 className={styles.panelTitle}>À lire aussi</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {related.map((post) => (
          <article key={post.id} className={styles.relatedCard}>
            <Link href={`/blog/${post.slug}`} className="block">
              <div className={styles.media}>
                <Image
                  src={post.coverImage}
                  alt={post.title}
                  fill
                  sizes="(max-width: 1024px) 50vw, 33vw"
                  className="object-contain"
                />
              </div>
              <div className={styles.relatedTitle}>
                <h3>{post.title}</h3>
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
