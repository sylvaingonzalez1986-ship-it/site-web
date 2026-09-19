import { NavigationPending } from "@/components/navigation/NavigationFeedback";
import styles from "@/components/blog/Blog.module.css";
export default function BlogPostLoading() {
  return (
    <>
      <NavigationPending />
      <section className={`section-band paper-grain pt-32 ${styles.page}`}>
        <div className="retro-container max-w-4xl">
          <div className={styles.loadingHeader}>
            <div className="h-4 w-1/4 animate-pulse rounded bg-[#ece7df]" />
            <div className="mt-4 h-10 w-4/5 animate-pulse rounded bg-[#ece7df]" />
            <div className="mt-8 h-72 w-full animate-pulse rounded bg-[#ece7df]" />
            <div className="mt-8 space-y-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-4 w-full animate-pulse rounded bg-[#ece7df]" />
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
