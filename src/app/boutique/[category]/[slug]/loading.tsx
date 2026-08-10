import styles from "./ProductDetailPage.module.css";

export default function ProductDetailLoading() {
  return (
    <section className={styles.page}>
      <div className="retro-container">
        <div className="h-4 w-1/3 animate-pulse bg-[#d8d0c3]" />
        <div className={`${styles.shell} mt-6`}>
          <div className={styles.grid}>
          <div className={styles.gallery}>
            <div className="aspect-square w-full animate-pulse border-3 border-ink bg-[#d8d0c3]" />
            <div className="mt-4 flex gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-16 w-16 animate-pulse border-2 border-ink bg-[#d8d0c3]" />
              ))}
            </div>
          </div>
          <div className={styles.info}>
            <div className="h-12 w-3/4 animate-pulse bg-[#d8d0c3]" />
            <div className="mt-5 h-5 w-1/3 animate-pulse bg-[#d8d0c3]" />
            <div className="mt-6 space-y-3">
              <div className="h-4 w-full animate-pulse bg-[#d8d0c3]" />
              <div className="h-4 w-5/6 animate-pulse bg-[#d8d0c3]" />
              <div className="h-4 w-2/3 animate-pulse bg-[#d8d0c3]" />
            </div>
            <div className="mt-8 h-24 w-full animate-pulse border-3 border-ink bg-[#d8d0c3]" />
          </div>
          </div>
        </div>
      </div>
    </section>
  );
}
