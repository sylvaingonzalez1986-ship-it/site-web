export default function BoutiqueCategoryLoading() {
  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-32">
      <div className="retro-container">
        <div className="cartoon-border bg-cream p-8">
          <div className="h-4 w-1/3 animate-pulse rounded bg-[#e8e3da]" />
          <div className="mt-4 h-10 w-1/2 animate-pulse rounded bg-[#e8e3da]" />
          <div className="mt-3 h-4 w-4/5 animate-pulse rounded bg-[#e8e3da]" />
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="card-cartoon overflow-hidden bg-cream p-5">
              <div className="h-44 w-full animate-pulse rounded bg-[#e8e3da]" />
              <div className="mt-4 h-6 w-2/3 animate-pulse rounded bg-[#e8e3da]" />
              <div className="mt-3 h-4 w-full animate-pulse rounded bg-[#e8e3da]" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
