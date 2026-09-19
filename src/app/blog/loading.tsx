import { NavigationPending } from "@/components/navigation/NavigationFeedback";
import styles from "@/components/blog/Blog.module.css";
export default function BlogLoading() {
  return (
    <>
      <NavigationPending />
      <section className={`section-band paper-grain pt-32 ${styles.page}`}>
        <div className="retro-container">
          <div className={styles.loadingHeader}>
            <div className="h-10 w-1/2 animate-pulse rounded bg-[#ece7df]" />
            <div className="mt-4 h-4 w-2/3 animate-pulse rounded bg-[#ece7df]" />
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <article key={index} className={styles.card}>
                <div className="h-44 w-full animate-pulse bg-[#ece7df]" />
                <div className="p-5">
                  <div className="h-6 w-4/5 animate-pulse rounded bg-[#ece7df]" />
                  <div className="mt-3 h-4 w-full animate-pulse rounded bg-[#ece7df]" />
                  <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-[#ece7df]" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
