export default function ProfileLoading() {
  return (
    <section className="section-band bg-mint halftone-overlay paper-grain pt-36">
      <div className="retro-container">
        <div className="cartoon-border bg-cream p-8">
          <div className="h-10 w-1/2 animate-pulse rounded bg-[#e8e3da]" />
          <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-[#e8e3da]" />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded bg-[#e8e3da]" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
