export default function CmsPageLoading() {
  return (
    <section className="section-band bg-cream halftone-overlay paper-grain pt-32">
      <div className="retro-container max-w-4xl">
        <div className="cartoon-border bg-white p-8">
          <div className="h-10 w-3/5 animate-pulse rounded bg-[#ece7df]" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-4 w-full animate-pulse rounded bg-[#ece7df]" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
