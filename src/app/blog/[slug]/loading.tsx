export default function BlogPostLoading() {
  return (
    <section className="section-band bg-cream halftone-overlay paper-grain pt-32">
      <div className="retro-container max-w-4xl">
        <div className="cartoon-border bg-white p-8">
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
  );
}
