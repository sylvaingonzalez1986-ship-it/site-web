export default function ProductDetailLoading() {
  return (
    <section className="section-band bg-cream halftone-overlay paper-grain pt-32">
      <div className="retro-container">
        <div className="h-4 w-1/3 animate-pulse rounded bg-[#e8e3da]" />
        <div className="mt-6 grid gap-8 md:grid-cols-2">
          <div className="cartoon-border bg-white p-4">
            <div className="aspect-square w-full animate-pulse rounded bg-[#ece7df]" />
            <div className="mt-4 flex gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-16 w-16 animate-pulse rounded bg-[#ece7df]" />
              ))}
            </div>
          </div>
          <div className="cartoon-border bg-cream p-8">
            <div className="h-8 w-3/4 animate-pulse rounded bg-[#e8e3da]" />
            <div className="mt-3 h-5 w-1/3 animate-pulse rounded bg-[#e8e3da]" />
            <div className="mt-6 space-y-3">
              <div className="h-4 w-full animate-pulse rounded bg-[#e8e3da]" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-[#e8e3da]" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-[#e8e3da]" />
            </div>
            <div className="mt-8 h-12 w-full animate-pulse rounded bg-[#e8e3da]" />
          </div>
        </div>
      </div>
    </section>
  );
}
