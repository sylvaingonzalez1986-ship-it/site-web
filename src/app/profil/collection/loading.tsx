export default function CollectionLoading() {
  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-36">
      <div className="retro-container">
        <div className="cartoon-border bg-cream p-8">
          <div className="h-10 w-1/3 animate-pulse rounded bg-[#e8e3da]" />
          <div className="mt-4 h-4 w-2/3 animate-pulse rounded bg-[#e8e3da]" />
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="aspect-[2/3] animate-pulse rounded bg-[#e8e3da]" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
