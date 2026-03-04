export default function RegisterLoading() {
  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-36">
      <div className="retro-container max-w-xl">
        <div className="cartoon-border bg-cream p-8">
          <div className="h-10 w-2/3 animate-pulse rounded bg-[#e8e3da]" />
          <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-[#e8e3da]" />
          <div className="mt-2 h-4 w-full animate-pulse rounded bg-[#e8e3da]" />
          <div className="mt-8 space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index}>
                <div className="h-4 w-1/4 animate-pulse rounded bg-[#e8e3da]" />
                <div className="mt-2 h-10 w-full animate-pulse rounded bg-[#e8e3da]" />
              </div>
            ))}
          </div>
          <div className="mt-6 h-12 w-full animate-pulse rounded bg-[#e8e3da]" />
        </div>
      </div>
    </section>
  );
}
